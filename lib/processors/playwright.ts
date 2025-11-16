// Playwright test artifact processor

import { BaseProcessor, ProcessedTestResult, SummaryStats, TimingInfo } from './base';

interface PlaywrightArtifact {
  config?: {
    configFile?: string;
    rootDir?: string;
    version?: string;
  };
  suites?: PlaywrightSuite[];
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}

interface PlaywrightSpec {
  title: string;
  file: string;
  line?: number;
  column?: number;
  tests: PlaywrightTest[];
}

interface PlaywrightTest {
  timeout?: number;
  annotations?: unknown[];
  expectedStatus: string;
  projectName?: string;
  projectId?: string;
  results: PlaywrightTestResult[];
  status?: string;
  title?: string;
}

interface PlaywrightTestResult {
  workerIndex?: number;
  status?: string;
  duration: number;
  error?: {
    message?: string;
    stack?: string;
  };
  errors?: Array<{
    message?: string;
    stack?: string;
  }>;
  retry?: number;
  startTime?: string;
  attachments?: unknown[];
}

export class PlaywrightProcessor extends BaseProcessor {
  detectFramework(artifact: unknown): boolean {
    const art = artifact as PlaywrightArtifact;
    return !!(art?.config?.configFile || art?.config?.rootDir);
  }

  extractVersion(artifact: unknown): string | null {
    const art = artifact as PlaywrightArtifact;
    return art?.config?.version || null;
  }

  parseResults(artifact: unknown): ProcessedTestResult[] {
    const art = artifact as PlaywrightArtifact;
    const results: ProcessedTestResult[] = [];

    if (!art.suites) {
      return results;
    }

    const processSuite = (suite: PlaywrightSuite, parentTitles: string[] = []) => {
      const suiteTitles = suite.title ? [...parentTitles, suite.title] : parentTitles;

      // Process specs in this suite
      if (suite.specs) {
        for (const spec of suite.specs) {
          if (spec.tests) {
            for (const test of spec.tests) {
              // Get the last result (most recent attempt)
              const lastResult = test.results?.[test.results.length - 1];
              if (!lastResult) continue;

              const fullTitle = [...suiteTitles, test.title || spec.title]
                .filter(Boolean)
                .join(' > ');

              results.push({
                testTitle: test.title || spec.title,
                fullTitle,
                status: lastResult.status || test.status || 'unknown',
                duration: lastResult.duration || 0,
                filePath: spec.file || '',
                projectName: test.projectName || test.projectId,
                retryAttempt: lastResult.retry || 0,
                errorMessage: lastResult.error?.message || lastResult.errors?.[0]?.message,
                errorStack: lastResult.error?.stack || lastResult.errors?.[0]?.stack,
                browser: test.projectName,
              });
            }
          }
        }
      }

      // Process nested suites recursively
      if (suite.suites) {
        for (const nestedSuite of suite.suites) {
          processSuite(nestedSuite, suiteTitles);
        }
      }
    };

    for (const suite of art.suites) {
      processSuite(suite);
    }

    return results;
  }

  getSummaryStats(artifact: unknown): SummaryStats {
    const results = this.parseResults(artifact);

    // Count by status
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const timedOut = results.filter((r) => r.status === 'timedOut').length;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
      timedOut,
    };
  }

  getTimingInfo(artifact: unknown): TimingInfo {
    const art = artifact as PlaywrightArtifact;

    if (!art.suites) {
      return {
        startTime: null,
        endTime: null,
        wallClockDuration: null,
      };
    }

    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    const processResults = (suite: PlaywrightSuite) => {
      if (suite.specs) {
        for (const spec of suite.specs) {
          if (spec.tests) {
            for (const test of spec.tests) {
              for (const result of test.results || []) {
                if (result.startTime) {
                  const startDate = new Date(result.startTime);
                  const endDate = new Date(startDate.getTime() + result.duration);

                  if (!earliestStart || startDate < earliestStart) {
                    earliestStart = startDate;
                  }

                  if (!latestEnd || endDate > latestEnd) {
                    latestEnd = endDate;
                  }
                }
              }
            }
          }
        }
      }

      if (suite.suites) {
        for (const nestedSuite of suite.suites) {
          processResults(nestedSuite);
        }
      }
    };

    for (const suite of art.suites) {
      processResults(suite);
    }

    if (earliestStart && latestEnd) {
      const wallClockDuration = (latestEnd as Date).getTime() - (earliestStart as Date).getTime();
      return {
        startTime: (earliestStart as Date).toISOString(),
        endTime: (latestEnd as Date).toISOString(),
        wallClockDuration,
      };
    }

    return {
      startTime: null,
      endTime: null,
      wallClockDuration: null,
    };
  }
}
