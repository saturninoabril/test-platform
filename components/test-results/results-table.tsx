// Table component for displaying test results

import React from 'react';

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
}

export interface ResultsTableProps {
  results: TestResult[];
  framework: 'playwright' | 'cypress';
}

export function ResultsTable({ results, framework }: ResultsTableProps) {
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

  if (results.length === 0) {
    return (
      <div className="border dark:border-gray-700 rounded-lg p-8 text-center bg-white dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">No test results found</p>
      </div>
    );
  }

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Test Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Duration
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                File Path
              </th>
              {framework === 'playwright' && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  Browser
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result) => {
              const testStatus = result.status || result.state || 'unknown';
              const filePath = result.filePath || result.specFile || '';

              return (
                <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {result.testTitle}
                    </div>
                    {result.fullTitle !== result.testTitle && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {result.fullTitle}
                      </div>
                    )}
                    {result.errorMessage && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1 font-mono">
                        {result.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(testStatus)}
                    {result.retryAttempt && result.retryAttempt > 0 && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        (retry {result.retryAttempt})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDuration(result.duration)}
                    {result.speed && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({result.speed})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {filePath}
                  </td>
                  {framework === 'playwright' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {result.browser || result.projectName || '-'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
