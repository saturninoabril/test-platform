import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TestReportContent } from '@/components/test-reports/test-report-content';
import { TestSummaryStats } from '@/components/test-results/test-summary';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  GitBranch,
  GitCommit,
  User,
  PlayCircle,
  Hash,
  Briefcase,
  Server,
  BookOpen,
} from 'lucide-react';

interface TestReport {
  id: string;
  framework: string;
  artifact: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  githubRepository?: string;
  githubSha?: string;
  githubHeadRef?: string;
  githubBaseRef?: string;
  githubRef?: string;
  githubActor?: string;
  githubRunId?: string;
  githubRunNumber?: number;
  githubRunAttempt?: number;
  githubJob?: string;
  runnerName?: string;
}

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

async function getTestReport(id: string): Promise<TestReport | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${API_URL}/api/test-reports/${id}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

async function getTestSummary(id: string): Promise<SummaryData | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  try {
    const res = await fetch(`${API_URL}/api/test-results/${id}/summary`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      // Check if it's a 400 with processing status info (pending/failed artifacts)
      if (res.status === 400) {
        const errorData = await res.json();
        if (errorData.processingStatus) {
          // Return a minimal summary object with processing status
          return {
            framework: 'playwright', // Default, will be ignored for non-processed
            frameworkVersion: null,
            processingStatus: errorData.processingStatus,
            processedAt: null,
            processingDurationMs: null,
            statistics: {
              total: 0,
              passed: 0,
              failed: 0,
              skipped: 0,
              pending: 0,
              timedOut: 0,
              passRate: 0,
              failRate: 0,
            },
          };
        }
      }
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

function MetadataItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex-shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
      <div className="text-sm truncate">{value}</div>
    </div>
  );
}

export default async function TestReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [report, summary] = await Promise.all([getTestReport(id), getTestSummary(id)]);

  if (!report) {
    notFound();
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container max-w-[1200px] mx-auto flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/test-reports">← Back</Link>
              </Button>
              <h1 className="text-xl font-semibold">Test Report Details</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild variant="outline">
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="container max-w-[1200px] mx-auto py-6">
          <TestReportContent
            artifactId={id}
            summary={summary}
            reportInfoContent={
              <>
                <CardContent className="pt-0">
                  <dl className="space-y-1">
                    {report.githubRepository && (
                      <MetadataItem
                        icon={BookOpen}
                        label="Repository"
                        value={report.githubRepository}
                      />
                    )}

                    {report.githubHeadRef && (
                      <MetadataItem
                        icon={GitBranch}
                        label="Branch"
                        value={
                          <Badge variant="outline" className="font-mono text-xs">
                            {report.githubHeadRef}
                          </Badge>
                        }
                      />
                    )}

                    {report.githubSha && (
                      <MetadataItem
                        icon={GitCommit}
                        label="Commit SHA"
                        value={
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {report.githubSha.substring(0, 7)}
                          </code>
                        }
                      />
                    )}

                    {report.githubActor && (
                      <MetadataItem icon={User} label="Triggered By" value={report.githubActor} />
                    )}

                    {report.githubRunId && (
                      <MetadataItem
                        icon={PlayCircle}
                        label="Run ID"
                        value={
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {report.githubRunId}
                          </code>
                        }
                      />
                    )}

                    {report.githubRunNumber && (
                      <MetadataItem
                        icon={Hash}
                        label="Run Number"
                        value={`#${report.githubRunNumber}`}
                      />
                    )}

                    {report.githubJob && (
                      <MetadataItem icon={Briefcase} label="Job" value={report.githubJob} />
                    )}

                    {report.runnerName && (
                      <MetadataItem icon={Server} label="Runner" value={report.runnerName} />
                    )}
                  </dl>
                </CardContent>
              </>
            }
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
