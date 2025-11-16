// Processor factory and framework detection

import { BaseProcessor } from './base';
import { PlaywrightProcessor } from './playwright';
import { CypressProcessor } from './cypress';

const processors: BaseProcessor[] = [new PlaywrightProcessor(), new CypressProcessor()];

/**
 * Get the appropriate processor for an artifact based on framework detection
 * @throws Error if no matching processor found
 */
export function getProcessor(artifact: unknown): BaseProcessor {
  for (const processor of processors) {
    if (processor.detectFramework(artifact)) {
      return processor;
    }
  }

  throw new Error(
    'Unknown framework: artifact does not match any supported framework (Playwright, Cypress)'
  );
}

/**
 * Detect the framework type from artifact structure
 * Returns the framework name or 'unknown'
 */
export function detectFrameworkType(artifact: unknown): 'playwright' | 'cypress' | 'unknown' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = artifact as any;

  // Playwright: has config.configFile or config.rootDir
  if (data?.config?.configFile || data?.config?.rootDir) {
    return 'playwright';
  }

  // Cypress: has stats object with suites/tests/passes/failures
  if (
    data?.stats &&
    typeof data.stats.suites === 'number' &&
    typeof data.stats.tests === 'number'
  ) {
    return 'cypress';
  }

  return 'unknown';
}

export type { BaseProcessor, ProcessedTestResult, SummaryStats } from './base';
