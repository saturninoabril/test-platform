'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TestResultsViewer } from '@/components/test-results/test-results-viewer';
import { TestSummaryWrapper } from '@/components/test-results/test-summary-wrapper';
import { FileSummaryWrapper } from '@/components/test-results/file-summary-wrapper';
import { TestOverviewHeader } from '@/components/test-results/test-overview-header';
import { TestSummaryStats } from '@/components/test-results/test-summary';

interface SummaryData {
  framework: 'playwright' | 'cypress';
  frameworkVersion: string | null;
  processingStatus: string;
  processedAt: string | null;
  processingDurationMs: number | null;
  cumulativeDuration?: number;
  wallClockDuration?: number;
  efficiencyPercent?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  statistics: TestSummaryStats;
}

interface TestReportContentProps {
  artifactId: string;
  summary: SummaryData | null;
  reportInfoContent: React.ReactNode;
}

export function TestReportContent({
  artifactId,
  summary,
  reportInfoContent,
}: TestReportContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize state from URL params
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get('status'));
  const [filterType, setFilterType] = useState<'test' | 'file'>(
    (searchParams.get('filterType') as 'test' | 'file') || 'test'
  );
  const [currentPage, setCurrentPage] = useState<number>(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get('pageSize') || '50'));
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>(
    searchParams.get('q') || ''
  );
  const [fileStats, setFileStats] = useState({
    totalFiles: 0,
    passedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
  });

  // Debounce search query: wait 500ms after user stops typing
  // Only trigger search if query is empty or >= 3 characters
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedQuery = searchQuery.trim();

      // Only update if empty (clear search) or >= 3 characters
      if (trimmedQuery.length === 0 || trimmedQuery.length >= 3) {
        setDebouncedSearchQuery(trimmedQuery);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL when filter, page, pageSize, or debounced search query changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearchQuery) {
      params.set('q', debouncedSearchQuery);
    }

    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    }

    if (pageSize !== 50) {
      params.set('pageSize', pageSize.toString());
    }

    if (statusFilter) {
      params.set('status', statusFilter);
      params.set('filterType', filterType);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    router.replace(newUrl, { scroll: false });
  }, [statusFilter, filterType, currentPage, pageSize, debouncedSearchQuery, router]);

  // Reset to page 1 when debounced search query changes
  const prevSearchQuery = useRef(debouncedSearchQuery);
  useEffect(() => {
    if (prevSearchQuery.current !== debouncedSearchQuery) {
      prevSearchQuery.current = debouncedSearchQuery;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(1);
    }
  }, [debouncedSearchQuery]);

  const handleTestFilterChange = (filter: string | null) => {
    // Only update if there's an actual change
    if (statusFilter !== filter || filterType !== 'test') {
      setStatusFilter(filter);
      setFilterType('test');
      setCurrentPage(1); // Reset to page 1 when filter changes
    }
  };

  const handleFileFilterChange = (filter: string | null) => {
    // Only update if there's an actual change
    if (statusFilter !== filter || filterType !== 'file') {
      setStatusFilter(filter);
      setFilterType('file');
      setCurrentPage(1); // Reset to page 1 when filter changes
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Page will be reset by the useEffect when debouncedSearchQuery changes
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to page 1 when page size changes
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Right side - Combined Summary and Info (sticky on desktop) */}
      <div className="w-full lg:w-80 lg:order-2 flex-shrink-0">
        <Card className="lg:sticky lg:top-6">
          {/* Test Overview Header */}
          {summary && summary.processingStatus === 'processed' && (
            <TestOverviewHeader
              framework={summary.framework}
              frameworkVersion={summary.frameworkVersion}
              passRate={summary.statistics.passRate}
              wallClockDuration={summary.wallClockDuration}
              cumulativeDuration={summary.cumulativeDuration}
              efficiencyPercent={summary.efficiencyPercent}
              createdAt={summary.createdAt}
            />
          )}

          {/* Test Summary Section */}
          {summary && summary.processingStatus === 'processed' ? (
            <TestSummaryWrapper
              statistics={summary.statistics}
              onFilterChange={handleTestFilterChange}
              currentFilter={filterType === 'test' ? statusFilter : null}
              hasActiveFilter={statusFilter !== null}
            />
          ) : (
            <>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  {summary
                    ? `Processing status: ${summary.processingStatus}`
                    : 'Loading test summary...'}
                </p>
              </CardContent>
            </>
          )}

          {/* File Summary Section */}
          <FileSummaryWrapper
            statistics={fileStats}
            onFilterChange={handleFileFilterChange}
            currentFilter={filterType === 'file' ? statusFilter : null}
            hasActiveFilter={statusFilter !== null}
          />

          {/* Report Information Section */}
          {reportInfoContent}
        </Card>
      </div>

      {/* Left side - Test Results (scrollable) */}
      <div className="flex-1 min-w-0 lg:order-1">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Test Results
        </h2>
        <TestResultsViewer
          artifactId={artifactId}
          hideSummary
          externalFilter={statusFilter}
          externalFilterType={filterType}
          externalPage={currentPage}
          externalPageSize={pageSize}
          externalSearchQuery={debouncedSearchQuery}
          externalSearchInput={searchQuery}
          onFileStatsChange={setFileStats}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSearchChange={handleSearchChange}
        />
      </div>
    </div>
  );
}
