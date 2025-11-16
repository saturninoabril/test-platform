'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileCheck2, FileX2, FileMinus2, FileText } from 'lucide-react';

interface FileSummaryStats {
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  skippedFiles: number;
}

interface FileSummaryItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  textColor: string;
  isActive: boolean;
  onClick: () => void;
}

function FileSummaryItem({
  icon: Icon,
  label,
  value,
  textColor,
  isActive,
  onClick,
}: FileSummaryItemProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-2 text-sm cursor-pointer transition-colors ${
        isActive
          ? 'bg-gray-100 dark:bg-gray-800 font-medium'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      } ${textColor}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p>
        {value} {label}
      </p>
    </div>
  );
}

interface FileSummaryWrapperProps {
  statistics: FileSummaryStats;
  onFilterChange?: (filter: string | null) => void;
  currentFilter?: string | null;
  hasActiveFilter?: boolean;
}

export function FileSummaryWrapper({
  statistics,
  onFilterChange,
  currentFilter,
  hasActiveFilter = false,
}: FileSummaryWrapperProps) {
  const handleFilterClick = (filter: string | null) => {
    if (!onFilterChange) return;

    // Toggle filter - if clicking the same filter, clear it
    if (currentFilter === filter) {
      onFilterChange(null);
    } else {
      onFilterChange(filter);
    }
  };
  return (
    <>
      <CardContent className="px-6">
        <div className="space-y-1">
          <div
            onClick={() => hasActiveFilter && onFilterChange && onFilterChange(null)}
            className={`flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 transition-colors ${
              hasActiveFilter
                ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'cursor-default'
            }`}
          >
            <FileText className="h-5 w-5 flex-shrink-0" />
            <p>{statistics.totalFiles} files</p>
          </div>
          <FileSummaryItem
            icon={FileCheck2}
            label="passed"
            value={statistics.passedFiles}
            textColor="text-green-600 dark:text-green-400"
            isActive={currentFilter === 'passed'}
            onClick={() => handleFilterClick('passed')}
          />
          <FileSummaryItem
            icon={FileX2}
            label="failed"
            value={statistics.failedFiles}
            textColor="text-red-600 dark:text-red-400"
            isActive={currentFilter === 'failed'}
            onClick={() => handleFilterClick('failed')}
          />
          {statistics.skippedFiles > 0 && (
            <FileSummaryItem
              icon={FileMinus2}
              label="skipped"
              value={statistics.skippedFiles}
              textColor="text-yellow-600 dark:text-yellow-400"
              isActive={currentFilter === 'skipped'}
              onClick={() => handleFilterClick('skipped')}
            />
          )}
        </div>
      </CardContent>
      <CardContent className="px-6">
        <Separator />
      </CardContent>
    </>
  );
}
