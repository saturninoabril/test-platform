'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, Clock, CircleDot, CircleMinus } from 'lucide-react';
import { TestSummaryStats } from './test-summary';

interface SummaryItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
  textColor: string;
  isActive: boolean;
  onClick: () => void;
}

function SummaryItem({ icon: Icon, label, value, textColor, isActive, onClick }: SummaryItemProps) {
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

interface TestSummaryWrapperProps {
  statistics: TestSummaryStats;
  onFilterChange: (filter: string | null) => void;
  currentFilter: string | null;
  hasActiveFilter?: boolean;
}

export function TestSummaryWrapper({
  statistics,
  onFilterChange,
  currentFilter,
  hasActiveFilter = false,
}: TestSummaryWrapperProps) {
  const handleFilterClick = (filter: string | null) => {
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
            onClick={() => hasActiveFilter && onFilterChange(null)}
            className={`flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 transition-colors ${
              hasActiveFilter
                ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'cursor-default'
            }`}
          >
            <CircleDot className="h-5 w-5 flex-shrink-0" />
            <p>{statistics.total} tests</p>
          </div>
          <SummaryItem
            icon={CheckCircle2}
            label="passed"
            value={statistics.passed}
            textColor="text-green-600 dark:text-green-400"
            isActive={currentFilter === 'passed'}
            onClick={() => handleFilterClick('passed')}
          />
          <SummaryItem
            icon={XCircle}
            label="failed"
            value={statistics.failed}
            textColor="text-red-400 dark:text-red-400"
            isActive={currentFilter === 'failed'}
            onClick={() => handleFilterClick('failed')}
          />
          {(statistics.skipped || 0) + (statistics.pending || 0) > 0 && (
            <SummaryItem
              icon={CircleMinus}
              label="skipped"
              value={(statistics.skipped || 0) + (statistics.pending || 0)}
              textColor="text-yellow-600 dark:text-yellow-400"
              isActive={currentFilter === 'skipped'}
              onClick={() => handleFilterClick('skipped')}
            />
          )}
          {(statistics.timedOut || 0) > 0 && (
            <SummaryItem
              icon={Clock}
              label="timed out"
              value={statistics.timedOut || 0}
              textColor="text-red-400 dark:text-red-400"
              isActive={currentFilter === 'timedOut'}
              onClick={() => handleFilterClick('timedOut')}
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
