// Grouped table component for displaying test results by file path

'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { HighlightText } from './highlight-text';
import { useTheme } from '@/components/theme-provider';

export interface TestResult {
  id: string;
  testTitle: string;
  fullTitle: string;
  status?: string; // Playwright: 'passed', 'failed', 'skipped', 'timedOut'
  state?: string; // Cypress: 'passed', 'failed', 'pending'
  duration: number;
  filePath?: string;
  specFile?: string;
  errorMessage?: string | null;
  projectName?: string | null;
  browser?: string | null;
  retryAttempt?: number;
  speed?: string | null;
  code?: string | null;
}

export interface FileGroup {
  filePath: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  hasFailures: boolean;
}

export interface GroupedResultsTableProps {
  groups: FileGroup[];
  framework: 'playwright' | 'cypress';
  searchQuery?: string;
}

export function GroupedResultsTable({
  groups,
  framework,
  searchQuery = '',
}: GroupedResultsTableProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const { resolvedTheme } = useTheme();

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const decodeHtmlEntities = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      passed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      skipped: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      timedOut: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    };

    const style =
      styles[status as keyof typeof styles] ||
      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';

    // Normalize pending to skipped for display
    const displayStatus = status === 'pending' ? 'skipped' : status;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}
      >
        {displayStatus}
      </span>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getTestSpeed = (duration: number, speed?: string | null) => {
    // If speed is already provided, use it
    if (speed) return speed;

    // Calculate speed based on Playwright thresholds
    if (framework === 'playwright') {
      if (duration > 10000) return 'slow';
      if (duration > 5000) return 'medium';
      return 'fast';
    }

    // For Cypress, use existing speed or default
    return null;
  };

  if (groups.length === 0) {
    return (
      <div className="border dark:border-gray-700 rounded-lg p-8 text-center bg-white dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">
          {searchQuery.trim() ? `No test results match "${searchQuery}"` : 'No test results found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedFiles.has(group.filePath);
        // Determine file status:
        // 1. If any test failed → 'failed'
        // 2. If at least one test passed → 'passed'
        // 3. If no tests passed and no tests failed (only skipped) → 'skipped'
        const fileStatus = group.hasFailures
          ? 'failed'
          : group.passedTests > 0
            ? 'passed'
            : 'skipped';

        return (
          <div
            key={group.filePath}
            className="border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm"
          >
            {/* File Header - Always Visible */}
            <button
              onClick={() => toggleFile(group.filePath)}
              className={`w-full px-6 py-4 flex items-center space-x-4 transition-colors cursor-pointer ${
                isExpanded
                  ? 'bg-gray-50 dark:bg-gray-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {/* Expand/Collapse Icon */}
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
                  isExpanded ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>

              {/* File Path and Summary */}
              <div className="flex-1 min-w-0 text-left">
                <div className="font-mono text-sm font-medium text-gray-900 dark:text-gray-200 truncate">
                  <HighlightText text={group.filePath} searchQuery={searchQuery} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  {fileStatus === 'failed' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                      Failed
                    </span>
                  ) : fileStatus === 'skipped' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      Skipped
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      Passed
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span
                    className={`font-medium ${group.passedTests > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    {group.passedTests}/{group.totalTests} passed
                  </span>
                  {group.failedTests > 0 && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {group.failedTests} failed
                      </span>
                    </>
                  )}
                  {group.skippedTests > 0 && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                        {group.skippedTests} skipped
                      </span>
                    </>
                  )}
                  <span className="text-gray-400 dark:text-gray-500">•</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatDuration(group.totalDuration)}
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded Test Details */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {group.tests.map((result) => {
                      const testStatus = result.status || result.state || 'unknown';
                      const testSpeed = getTestSpeed(result.duration, result.speed);

                      let hoverClass = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                      if (testStatus === 'passed') {
                        hoverClass = 'hover:bg-green-50 dark:hover:bg-green-900/20';
                      } else if (testStatus === 'failed') {
                        hoverClass = 'hover:bg-red-50 dark:hover:bg-red-900/20';
                      } else if (testStatus === 'skipped' || testStatus === 'pending') {
                        hoverClass = 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20';
                      } else if (testStatus === 'timedOut') {
                        hoverClass = 'hover:bg-orange-50 dark:hover:bg-orange-900/20';
                      }

                      return (
                        <tr key={result.id} className={hoverClass}>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              <HighlightText text={result.testTitle} searchQuery={searchQuery} />
                            </div>
                            {result.fullTitle !== result.testTitle && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <HighlightText text={result.fullTitle} searchQuery={searchQuery} />
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {getStatusBadge(testStatus)}
                              {result.retryAttempt != null && result.retryAttempt > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  (retry {result.retryAttempt})
                                </span>
                              )}
                              <span className="text-gray-400 dark:text-gray-500">•</span>
                              <span
                                className={`text-xs ${
                                  testSpeed === 'slow'
                                    ? 'text-orange-700 dark:text-orange-500 font-semibold'
                                    : testSpeed === 'medium'
                                      ? 'text-orange-500 dark:text-orange-400 font-medium'
                                      : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                {formatDuration(result.duration)}
                                {testSpeed && (
                                  <span
                                    className={`ml-2 text-xs ${
                                      testSpeed === 'slow'
                                        ? 'text-orange-700 dark:text-orange-500'
                                        : testSpeed === 'medium'
                                          ? 'text-orange-500 dark:text-orange-400'
                                          : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    ({testSpeed})
                                  </span>
                                )}
                              </span>
                              {framework === 'playwright' && result.browser && (
                                <>
                                  <span className="text-gray-400 dark:text-gray-500">•</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {result.browser || result.projectName}
                                  </span>
                                </>
                              )}
                            </div>
                            {result.errorMessage && (
                              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
                                  Error:
                                </div>
                                <div className="text-xs text-red-600 dark:text-red-300 font-mono whitespace-pre-wrap break-words">
                                  {decodeHtmlEntities(result.errorMessage)}
                                </div>
                              </div>
                            )}
                            {result.code && framework === 'cypress' && (
                              <details className="mt-2">
                                <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300">
                                  View test code
                                </summary>
                                <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                  <style
                                    dangerouslySetInnerHTML={{
                                      __html: `
                                      .syntax-highlighter-wrapper code > span {
                                        display: block;
                                        padding-left: 3.5em;
                                        text-indent: -3.5em;
                                        white-space: pre-wrap !important;
                                        word-break: break-word;
                                      }
                                      .syntax-highlighter-wrapper .linenumber,
                                      .syntax-highlighter-wrapper .react-syntax-highlighter-line-number {
                                        width: 3.5em;
                                        display: inline-block !important;
                                        text-indent: 0 !important;
                                        padding-right: 0.5em;
                                        text-align: right;
                                        user-select: none;
                                        flex-shrink: 0;
                                      }
                                    `,
                                    }}
                                  />
                                  <div className="syntax-highlighter-wrapper">
                                    <SyntaxHighlighter
                                      language="javascript"
                                      style={resolvedTheme === 'dark' ? oneDark : tomorrow}
                                      customStyle={{
                                        margin: 0,
                                        fontSize: '0.75rem',
                                        padding: '0.5rem',
                                      }}
                                      showLineNumbers={true}
                                      wrapLines={true}
                                    >
                                      {result.code}
                                    </SyntaxHighlighter>
                                  </div>
                                </div>
                              </details>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
