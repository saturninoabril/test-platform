/**
 * Test Report Summary Utility
 * Extracts test summaries from different testing framework artifacts
 */

export interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  duration: number; // in milliseconds
  passRate: number; // percentage (0-100)
}

/**
 * Extract summary from Cypress (mochawesome) test artifact
 */
function extractCypressSummary(artifact: unknown): TestSummary | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = artifact as any;
    const stats = data.stats;
    if (!stats) return null;

    return {
      totalTests: stats.tests || 0,
      passed: stats.passes || 0,
      failed: stats.failures || 0,
      skipped: stats.skipped || 0,
      pending: stats.pending || 0,
      duration: stats.duration || 0,
      passRate: stats.passPercent || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract summary from Playwright test artifact
 */
function extractPlaywrightSummary(artifact: unknown): TestSummary | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = artifact as any;
    const suites = data.suites || [];
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;
    let duration = 0;

    // Recursively count tests in suites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function processSuite(suite: any) {
      if (suite.specs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        suite.specs.forEach((spec: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          spec.tests?.forEach((test: any) => {
            totalTests++;
            const result = test.results?.[0];
            if (result) {
              duration += result.duration || 0;

              if (result.status === 'expected' || result.status === 'passed') {
                passed++;
              } else if (result.status === 'failed' || result.status === 'unexpected') {
                failed++;
              } else if (result.status === 'skipped') {
                skipped++;
              } else if (result.status === 'pending') {
                pending++;
              }
            }
          });
        });
      }

      // Process nested suites
      if (suite.suites) {
        suite.suites.forEach(processSuite);
      }
    }

    suites.forEach(processSuite);

    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    return {
      totalTests,
      passed,
      failed,
      skipped,
      pending,
      duration,
      passRate,
    };
  } catch {
    return null;
  }
}

/**
 * Extract summary from any supported test framework
 */
export function extractTestSummary(framework: string, artifact: unknown): TestSummary | null {
  const lowerFramework = framework.toLowerCase();

  if (lowerFramework === 'cypress') {
    return extractCypressSummary(artifact);
  } else if (lowerFramework === 'playwright') {
    return extractPlaywrightSummary(artifact);
  }

  // Unknown framework, return null
  return null;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}
