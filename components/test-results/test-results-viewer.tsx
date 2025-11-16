// Client-side component for fetching and displaying test results

'use client';

import { useState, useEffect, useMemo } from 'react';
import { TestSummary, TestSummaryStats } from './test-summary';
import { GroupedResultsTable, FileGroup, TestResult } from './grouped-results-table';
import { Pagination } from './pagination';
import { SearchInput } from './search-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TestResultsViewerProps {
  artifactId: string;
  hideSummary?: boolean;
  externalFilter?: string | null;
  externalFilterType?: 'test' | 'file'; // Type of filter: test-level or file-level
  externalPage?: number;
  externalPageSize?: number;
  externalSearchQuery?: string; // Debounced query for API calls
  externalSearchInput?: string; // Immediate input value for display
  onFileStatsChange?: (stats: {
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    skippedFiles: number;
  }) => void;
  onPageChange?: (page: number) => void;
  onSearchChange?: (query: string) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

interface SummaryData {
  framework: 'playwright' | 'cypress';
  frameworkVersion: string | null;
  processingStatus: string;
  processedAt: string | null;
  processingDurationMs: number | null;
  statistics: TestSummaryStats;
}

interface FileSummaryData {
  framework: 'playwright' | 'cypress';
  data: {
    filePath?: string;
    specFile?: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    totalDuration: number;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalFiles: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface TestDetailsData {
  framework: 'playwright' | 'cypress';
  data: TestResult[];
}

export function TestResultsViewer({
  artifactId,
  hideSummary = false,
  externalFilter,
  externalFilterType,
  externalPage,
  externalPageSize,
  externalSearchQuery,
  externalSearchInput,
  onFileStatsChange,
  onPageChange,
  onSearchChange,
  onPageSizeChange,
}: TestResultsViewerProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [fileData, setFileData] = useState<FileSummaryData | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');

  // Use external page if provided, otherwise use internal state
  const currentPage = externalPage !== undefined ? externalPage : internalPage;

  // Use external page size if provided, otherwise use internal state
  const pageSize = externalPageSize !== undefined ? externalPageSize : internalPageSize;

  // Use external filter if provided
  const statusFilter = externalFilter || null;

  // Use external search query (debounced) for API calls, otherwise use internal state
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;

  // Use external search input (immediate) for display, otherwise use internal state
  const searchInputValue =
    externalSearchInput !== undefined ? externalSearchInput : internalSearchQuery;

  // Fetch summary
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_URL}/api/test-results/${artifactId}/summary`);

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to fetch summary');
        }

        const data = await res.json();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch summary');
      }
    };

    fetchSummary();
  }, [artifactId]);

  // Fetch results with two-phase approach: files first, then test details
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const query = searchQuery.trim();

        // If there's a search query, use the search endpoint
        if (query) {
          const searchParams = new URLSearchParams({
            q: query,
            page: currentPage.toString(),
            pageSize: pageSize.toString(),
          });

          if (statusFilter) {
            searchParams.append('status', statusFilter);
          }

          if (externalFilterType) {
            searchParams.append('filterType', externalFilterType);
          }

          const searchRes = await fetch(
            `${API_URL}/api/test-results/${artifactId}/search?${searchParams.toString()}`
          );

          if (!searchRes.ok) {
            const errorData = await searchRes.json();
            throw new Error(errorData.message || 'Search failed');
          }

          const searchData: FileSummaryData = await searchRes.json();
          setFileData(searchData);

          // Fetch test details for the search results
          if (searchData.data.length > 0) {
            const fileNames = searchData.data.map((f) => f.filePath || f.specFile).filter(Boolean);
            const filesParam = fileNames.join(',');

            const testsRes = await fetch(
              `${API_URL}/api/test-results/${artifactId}/files/tests?files=${encodeURIComponent(filesParam)}`
            );

            if (!testsRes.ok) {
              const errorData = await testsRes.json();
              throw new Error(errorData.message || 'Failed to fetch test details');
            }

            const testsData: TestDetailsData = await testsRes.json();
            setTestResults(testsData.data);
          } else {
            setTestResults([]);
          }
        } else {
          // No search query: use normal file pagination
          // Phase 1: Fetch paginated file summaries
          const fileParams = new URLSearchParams({
            page: currentPage.toString(),
            pageSize: pageSize.toString(),
          });

          if (statusFilter) {
            fileParams.append('status', statusFilter);
          }

          if (externalFilterType) {
            fileParams.append('filterType', externalFilterType);
          }

          const filesRes = await fetch(
            `${API_URL}/api/test-results/${artifactId}/files?${fileParams.toString()}`
          );

          if (!filesRes.ok) {
            const errorData = await filesRes.json();
            throw new Error(errorData.message || 'Failed to fetch file summaries');
          }

          const filesData: FileSummaryData = await filesRes.json();
          setFileData(filesData);

          // Phase 2: Fetch test details for the files on this page
          if (filesData.data.length > 0) {
            const fileNames = filesData.data.map((f) => f.filePath || f.specFile).filter(Boolean);
            const filesParam = fileNames.join(',');

            const testsRes = await fetch(
              `${API_URL}/api/test-results/${artifactId}/files/tests?files=${encodeURIComponent(filesParam)}`
            );

            if (!testsRes.ok) {
              const errorData = await testsRes.json();
              throw new Error(errorData.message || 'Failed to fetch test details');
            }

            const testsData: TestDetailsData = await testsRes.json();
            setTestResults(testsData.data);
          } else {
            setTestResults([]);
          }
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch results');
      } finally {
        setLoading(false);
      }
    };

    if (summary) {
      fetchResults();
    }
  }, [artifactId, currentPage, pageSize, statusFilter, externalFilterType, summary, searchQuery]);

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    } else {
      setInternalPageSize(newPageSize);
      setInternalPage(1); // Reset to page 1 when page size changes
    }
  };

  const handleSearchChange = (query: string) => {
    if (onSearchChange) {
      onSearchChange(query);
    } else {
      setInternalSearchQuery(query);
    }
  };

  // Group results by file path with summaries
  // Note: Search filtering is now done server-side, so no need to filter here
  const groupedResults = useMemo<FileGroup[]>(() => {
    if (!fileData) return [];
    if (testResults.length === 0) return [];

    const groups = new Map<string, FileGroup>();

    testResults.forEach((result) => {
      const filePath = result.filePath || result.specFile || 'Unknown File';
      const status = result.status || result.state || 'unknown';

      if (!groups.has(filePath)) {
        groups.set(filePath, {
          filePath,
          tests: [],
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          totalDuration: 0,
          hasFailures: false,
        });
      }

      const group = groups.get(filePath)!;
      group.tests.push(result);
      group.totalTests++;
      group.totalDuration += result.duration || 0;

      if (status === 'passed') {
        group.passedTests++;
      } else if (status === 'failed') {
        group.failedTests++;
        group.hasFailures = true;
      } else if (status === 'skipped' || status === 'pending') {
        group.skippedTests++;
      }
    });

    // Convert to array and sort by file path
    return Array.from(groups.values()).sort((a, b) => a.filePath.localeCompare(b.filePath));
  }, [fileData, testResults]);

  // Fetch file-level statistics from dedicated API endpoint
  useEffect(() => {
    if (!onFileStatsChange || !summary) return;

    const fetchFileStats = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_URL}/api/test-results/${artifactId}/files`);

        if (!res.ok) {
          console.error('Failed to fetch file statistics');
          return;
        }

        const data = await res.json();
        onFileStatsChange(data.statistics);
      } catch (err) {
        console.error('Failed to fetch file statistics:', err);
      }
    };

    fetchFileStats();
  }, [artifactId, summary, onFileStatsChange]);

  if (error && !summary) {
    return (
      <div className="border rounded-lg p-6 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200">
        <h3 className="font-semibold mb-2">Error Loading Test Results</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Loading test results...</span>
        </div>
      </div>
    );
  }

  // Check if artifact is not processed yet
  if (summary.processingStatus !== 'processed') {
    const statusMessages: { [key: string]: { title: string; message: string; color: string } } = {
      pending: {
        title: 'Processing Pending',
        message: 'This artifact is queued for processing. Please check back in a moment.',
        color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200',
      },
      processing: {
        title: 'Currently Processing',
        message: 'This artifact is being processed right now. Please refresh the page in a moment.',
        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200',
      },
      processing_failed: {
        title: 'Processing Failed',
        message:
          'An error occurred while processing this artifact. Please try reprocessing or contact support.',
        color: 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200',
      },
    };

    const statusInfo = statusMessages[summary.processingStatus] || {
      title: 'Unknown Status',
      message: `Artifact is in status: ${summary.processingStatus}`,
      color: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200',
    };

    return (
      <div className={`border dark:border-gray-700 rounded-lg p-6 ${statusInfo.color}`}>
        <h3 className="font-semibold mb-2">{statusInfo.title}</h3>
        <p className="text-sm">{statusInfo.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      {!hideSummary && (
        <TestSummary
          stats={summary.statistics}
          framework={summary.framework}
          frameworkVersion={summary.frameworkVersion}
          processingDurationMs={summary.processingDurationMs}
        />
      )}

      {/* Search Input */}
      <SearchInput
        value={searchInputValue}
        onChange={handleSearchChange}
        placeholder="Search spec files and test names..."
      />

      {/* Results Table */}
      {loading ? (
        <div className="border dark:border-gray-700 rounded-lg p-12 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">Loading results...</span>
          </div>
        </div>
      ) : error ? (
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200">
          <h3 className="font-semibold mb-2">Error Loading Results</h3>
          <p className="text-sm">{error}</p>
        </div>
      ) : fileData ? (
        <>
          {/* Pagination - Top */}
          {fileData.pagination.totalPages > 1 && (
            <Pagination
              currentPage={fileData.pagination.page}
              totalPages={fileData.pagination.totalPages}
              totalCount={fileData.pagination.totalFiles}
              pageSize={fileData.pagination.pageSize}
              hasNextPage={fileData.pagination.hasNextPage}
              hasPreviousPage={fileData.pagination.hasPreviousPage}
              onPageChange={handlePageChange}
            />
          )}

          <GroupedResultsTable
            groups={groupedResults}
            framework={fileData.framework}
            searchQuery={searchQuery}
          />

          {/* Pagination and Page Size - Bottom */}
          {fileData.pagination.totalPages > 1 && (
            <div className="border-gray-200 dark:border-gray-700 rounded-b-lg">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Items per page:
                  </span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => handlePageSizeChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-auto">
                  <nav
                    className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label="Pagination"
                  >
                    {/* Previous Button */}
                    <button
                      onClick={() =>
                        fileData.pagination.hasPreviousPage &&
                        handlePageChange(fileData.pagination.page - 1)
                      }
                      disabled={!fileData.pagination.hasPreviousPage}
                      className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 ${
                        fileData.pagination.hasPreviousPage
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600">
                      Page {fileData.pagination.page} of {fileData.pagination.totalPages}
                    </span>

                    {/* Next Button */}
                    <button
                      onClick={() =>
                        fileData.pagination.hasNextPage &&
                        handlePageChange(fileData.pagination.page + 1)
                      }
                      disabled={!fileData.pagination.hasNextPage}
                      className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 ${
                        fileData.pagination.hasNextPage
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
