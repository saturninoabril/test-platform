'use client';

import { CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, Clock, Calendar, Zap } from 'lucide-react';

interface TestOverviewHeaderProps {
  framework: 'playwright' | 'cypress';
  frameworkVersion?: string | null;
  passRate: number;
  wallClockDuration?: number;
  cumulativeDuration?: number;
  efficiencyPercent?: number | null;
  createdAt?: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // If more than 30 days, show full date/time format
  if (diffDays > 30) {
    return date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // Otherwise show relative time
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffMinutes > 0) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else {
    return 'just now';
  }
}

export function TestOverviewHeader({
  framework,
  frameworkVersion,
  passRate,
  wallClockDuration,
  cumulativeDuration,
  efficiencyPercent,
  createdAt,
}: TestOverviewHeaderProps) {
  return (
    <>
      <CardContent className="px-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="capitalize text-sm font-semibold text-gray-900 dark:text-gray-100">
            {framework}
            {frameworkVersion && ` v${frameworkVersion}`}
          </h3>
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
            <Tooltip>
              <TooltipTrigger asChild>
                <Target className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pass rate</p>
              </TooltipContent>
            </Tooltip>
            <p>{passRate.toFixed(1)}% passed</p>
          </div>

          {wallClockDuration !== undefined && (
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-5 w-5 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Actual duration (start to end)</p>
                </TooltipContent>
              </Tooltip>
              <p>{formatDuration(wallClockDuration)}</p>
            </div>
          )}

          {cumulativeDuration !== undefined &&
            wallClockDuration !== undefined &&
            cumulativeDuration > wallClockDuration && (
              <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Zap className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Cumulative: {formatDuration(cumulativeDuration)}
                      {efficiencyPercent && ` (${efficiencyPercent.toFixed(1)}% faster)`}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <p>
                  {efficiencyPercent
                    ? `${efficiencyPercent.toFixed(1)}% faster`
                    : 'Parallel execution'}
                </p>
              </div>
            )}

          {createdAt && (
            <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Created at</p>
                </TooltipContent>
              </Tooltip>
              <p>{formatTimeAgo(createdAt)}</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardContent className="px-6">
        <Separator />
      </CardContent>
    </>
  );
}
