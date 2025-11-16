// Cypress test artifact processor

import { BaseProcessor, ProcessedTestResult, SummaryStats, TimingInfo } from './base';

interface CypressArtifact {
  stats?: {
    suites?: number;
    tests?: number;
    passes?: number;
    pending?: number;
    failures?: number;
    start?: string;
    end?: string;
    duration?: number;
  };
  results?: CypressResult[];
  config?: {
    version?: string;
  };
}

interface CypressResult {
  uuid?: string;
  title?: string;
  fullFile?: string;
  file?: string;
  beforeHooks?: unknown[];
  afterHooks?: unknown[];
  tests?: unknown[];
  suites?: CypressSuite[];
}

interface CypressSuite {
  uuid: string;
  title: string;
  fullFile?: string;
  file?: string;
  beforeHooks?: unknown[];
  afterHooks?: unknown[];
  tests: CypressTest[];
  suites?: CypressSuite[];
}

interface CypressTest {
  title: string;
  fullTitle: string;
  timedOut: boolean | null;
  duration: number;
  state: string; // 'passed', 'failed', 'pending'
  speed?: string | null;
  pass: boolean;
  fail: boolean;
  pending: boolean;
  context?: string | null;
  code?: string;
  err?: {
    message?: string;
    estack?: string;
    diff?: string | null;
    name?: string;
  };
  uuid: string;
  parentUUID: string;
  isHook: boolean;
  skipped: boolean;
}

export class CypressProcessor extends BaseProcessor {
  detectFramework(artifact: unknown): boolean {
    const art = artifact as CypressArtifact;
    return !!(
      art?.stats &&
      typeof art.stats.suites === 'number' &&
      typeof art.stats.tests === 'number'
    );
  }

  extractVersion(artifact: unknown): string | null {
    const art = artifact as CypressArtifact;
    return art?.config?.version || null;
  }

  parseResults(artifact: unknown): ProcessedTestResult[] {
    const art = artifact as CypressArtifact;
    const results: ProcessedTestResult[] = [];

    if (!art.results) {
      return results;
    }

    const processSuite = (suite: CypressSuite, specFile: string) => {
      if (suite.tests) {
        for (const test of suite.tests) {
          // Skip hooks
          if (test.isHook) continue;

          results.push({
            testTitle: test.title,
            fullTitle: test.fullTitle,
            status: test.state,
            duration: test.duration || 0,
            filePath: specFile,
            testUuid: test.uuid,
            suiteUuid: suite.uuid,
            parentUuid: test.parentUUID,
            code: test.code,
            errorMessage: test.err?.message,
            errorName: test.err?.name,
            speed: test.speed || undefined,
          });
        }
      }

      // Process nested suites recursively
      if (suite.suites) {
        for (const nestedSuite of suite.suites) {
          processSuite(nestedSuite, specFile);
        }
      }
    };

    for (const result of art.results) {
      const specFile = result.file || result.fullFile || '';

      if (result.suites) {
        for (const suite of result.suites) {
          processSuite(suite, specFile);
        }
      }
    }

    return results;
  }

  getSummaryStats(artifact: unknown): SummaryStats {
    const art = artifact as CypressArtifact;

    return {
      total: art.stats?.tests || 0,
      passed: art.stats?.passes || 0,
      failed: art.stats?.failures || 0,
      pending: art.stats?.pending || 0,
    };
  }

  getTimingInfo(artifact: unknown): TimingInfo {
    const art = artifact as CypressArtifact;

    const startTime = art.stats?.start || null;
    const endTime = art.stats?.end || null;
    const wallClockDuration = art.stats?.duration || null;

    return {
      startTime,
      endTime,
      wallClockDuration,
    };
  }
}
