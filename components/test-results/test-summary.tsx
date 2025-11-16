// Summary statistics component for test results

import React from 'react';

export interface TestSummaryStats {
  total: number;
  passed: number;
  failed: number;
  skipped?: number;
  pending?: number;
  timedOut?: number;
  passRate: number;
  failRate: number;
}

export interface TestSummaryProps {
  stats: TestSummaryStats;
  framework?: string;
  frameworkVersion?: string | null;
  processingDurationMs?: number | null;
}

export function TestSummary({
  stats,
  framework,
  frameworkVersion,
  processingDurationMs,
}: TestSummaryProps) {
  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="border dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Test Summary</h2>
        {framework && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {framework}
            {frameworkVersion && ` v${frameworkVersion}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Tests */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {stats.total}
          </div>
        </div>

        {/* Passed Tests */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-green-700 dark:text-green-400">Passed</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300 mt-1">
            {stats.passed}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {stats.passRate.toFixed(1)}%
          </div>
        </div>

        {/* Failed Tests */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-400">Failed</div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-300 mt-1">
            {stats.failed}
          </div>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            {stats.failRate.toFixed(1)}%
          </div>
        </div>

        {/* Skipped/Pending Tests */}
        {stats.skipped || stats.pending ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              Skipped/Pending
            </div>
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-300 mt-1">
              {(stats.skipped || 0) + (stats.pending || 0)}
            </div>
          </div>
        ) : null}

        {/* Timed Out Tests */}
        {stats.timedOut ? (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Timed Out
            </div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-300 mt-1">
              {stats.timedOut}
            </div>
          </div>
        ) : null}
      </div>

      {/* Processing Info */}
      {processingDurationMs && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Processing time: {formatDuration(processingDurationMs)}
          </div>
        </div>
      )}
    </div>
  );
}
