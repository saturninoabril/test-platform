import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  User,
  MinusCircle,
  Play,
} from 'lucide-react';
import { formatDuration } from '@/lib/test-reports/summary';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSizeSelector } from '@/components/page-size-selector';
import { ThemeToggle } from '@/components/theme-toggle';

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  duration: number;
  passRate: number;
}

interface TestReport {
  id: string;
  framework: string;
  createdAt: string;
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
  summary: TestSummary | null;
}

interface TestReportsResponse {
  data: TestReport[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

async function getTestReports(
  page: number = 1,
  pageSize: number = 20
): Promise<TestReportsResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const res = await fetch(`${API_URL}/api/test-reports?page=${page}&pageSize=${pageSize}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch test reports');
  }

  return res.json();
}

function StatusBadge({ passRate }: { passRate: number }) {
  const isAllPassed = passRate === 100;
  const colorClass = isAllPassed
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={`flex items-center gap-1.5 ${colorClass}`}>
      {isAllPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      <span className="text-[13px] font-semibold">{passRate.toFixed(0)}%</span>
    </div>
  );
}

function TestReportCard({ report, isLast }: { report: TestReport; isLast: boolean }) {
  const summary = report.summary;
  const createdDate = new Date(report.createdAt);
  const dateStr = createdDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = createdDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link href={`/test-reports/${report.id}`} className="block group">
      <Card
        className={`p-5 rounded-none border-0 ${!isLast ? 'border-b' : ''} hover:bg-accent/50 transition-colors`}
      >
        <div className="flex items-center gap-6 min-h-[60px] flex-wrap">
          {/* Left: Framework + Info */}
          <div className="flex items-center shrink-0 w-[160px]">
            <div className="flex-1">
              <h3 className="font-semibold text-sm capitalize leading-tight mb-1">
                {report.framework}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground leading-tight">
                <Calendar className="h-3 w-3" />
                <span>{dateStr}</span>
                <span>•</span>
                <span>{timeStr}</span>
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-border shrink-0" />

          {/* Center: Metadata (Repo + Branch + Actor) */}
          <div className="flex items-center gap-5 text-sm flex-1 min-w-0 flex-wrap">
            {report.githubRepository && (
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Play className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-[13px]">{report.githubRepository}</span>
              </div>
            )}
            {report.githubHeadRef && (
              <div className="flex items-center gap-2 shrink-0">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <Badge variant="outline" className="font-mono text-[11px] h-5 px-2">
                  {report.githubHeadRef}
                </Badge>
              </div>
            )}
            {report.githubActor && (
              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                <User className="h-3.5 w-3.5" />
                <span className="text-[13px]">{report.githubActor}</span>
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-border shrink-0" />

          {/* Right: Test Stats + Status */}
          {summary ? (
            <div className="flex items-center gap-5 shrink-0 w-[340px]">
              <div className="flex flex-col gap-2 min-w-[180px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-muted-foreground">Total:</span>
                  <span className="text-[13px] font-medium">{summary.totalTests}</span>
                </div>

                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    <span className="text-[13px] font-semibold text-green-600 dark:text-green-400">
                      {summary.passed}
                    </span>
                  </div>

                  {summary.failed > 0 && (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      <span className="text-[13px] font-semibold text-red-600 dark:text-red-400">
                        {summary.failed}
                      </span>
                    </div>
                  )}

                  {summary.skipped > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MinusCircle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-[13px] font-semibold text-yellow-600 dark:text-yellow-400">
                        {summary.skipped}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[13px] font-medium">
                    {formatDuration(summary.duration)}
                  </span>
                </div>

                <StatusBadge passRate={summary.passRate} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic shrink-0">
              <MinusCircle className="h-3.5 w-3.5" />
              <span className="text-[13px]">No summary available</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default async function TestReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const pageSize = Math.min(Math.max(parseInt(params.pageSize || '50'), 50), 100);
  const { data: reports, pagination } = await getTestReports(page, pageSize);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-[1000px] mx-auto flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold">Test Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              View and analyze your test execution results
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-[1000px] mx-auto py-8">
        {reports.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div>
                <p className="text-lg font-medium">No test reports found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload test artifacts to see reports here
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {Math.min((page - 1) * pageSize + 1, pagination.totalCount)}-
                {Math.min(page * pageSize, pagination.totalCount)} of{' '}
              </span>
              <span className="font-medium">{pagination.totalCount}</span>
              <span className="text-muted-foreground">
                {pagination.totalCount === 1 ? 'report' : 'reports'}
              </span>
            </div>

            <div className="border rounded-xl overflow-hidden">
              {reports.map((report, index) => (
                <TestReportCard
                  key={report.id}
                  report={report}
                  isLast={index === reports.length - 1}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
              {pagination.totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2 flex-1">
                  {pagination.hasPreviousPage && (
                    <Button asChild variant="outline">
                      <Link href={`/test-reports?page=${page - 1}&pageSize=${pageSize}`}>
                        Previous
                      </Link>
                    </Button>
                  )}

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (page <= 4) {
                        pageNum = i + 1;
                      } else if (page >= pagination.totalPages - 3) {
                        pageNum = pagination.totalPages - 6 + i;
                      } else {
                        pageNum = page - 3 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          asChild
                          variant={pageNum === page ? 'default' : 'outline'}
                          size="sm"
                          className="w-9 h-9 p-0"
                        >
                          <Link href={`/test-reports?page=${pageNum}&pageSize=${pageSize}`}>
                            {pageNum}
                          </Link>
                        </Button>
                      );
                    })}
                  </div>

                  {pagination.hasNextPage && (
                    <Button asChild variant="outline">
                      <Link href={`/test-reports?page=${page + 1}&pageSize=${pageSize}`}>Next</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div />
              )}

              <PageSizeSelector />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
