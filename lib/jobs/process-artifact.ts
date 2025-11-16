// Background job for processing test artifacts
// Extracts test results and stores them in framework-specific tables

import { getProcessor, detectFrameworkType } from '@/lib/processors';
import {
  testArtifactsRepository,
  playwrightTestResultsRepository,
  cypressTestResultsRepository,
  type CreatePlaywrightTestResultInput,
  type CreateCypressTestResultInput,
} from '@/lib/db/repositories';

/**
 * Truncate a string to a maximum length
 * Ensures data doesn't exceed database/validation limits
 */
function truncateString(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength);
}

/**
 * Process a test artifact by extracting test results and storing them in the database
 * @param artifactId - UUID of the artifact to process
 * @returns Promise<void>
 * @throws Error if processing fails
 */
export async function processArtifact(artifactId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Fetch the artifact from database (with full artifact payload)
    const artifact = await testArtifactsRepository.getArtifactByIdWithArtifact(artifactId);

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // 2. Update status to 'processing'
    await testArtifactsRepository.updateProcessingStatus(artifactId, 'processing');

    // 3. Detect framework and get appropriate processor
    const frameworkType = detectFrameworkType(artifact.artifact);

    if (frameworkType === 'unknown') {
      throw new Error(
        `Unable to detect framework for artifact ${artifactId}. Framework field: ${artifact.framework}`
      );
    }

    const processor = getProcessor(artifact.artifact);

    // 4. Extract version and parse test results
    const frameworkVersion = processor.extractVersion(artifact.artifact);
    const testResults = processor.parseResults(artifact.artifact);

    // 5. Store results in framework-specific table using repositories
    if (frameworkType === 'playwright') {
      // Batch insert Playwright test results via repository
      if (testResults.length > 0) {
        const inputs: CreatePlaywrightTestResultInput[] = testResults.map(
          (result: Record<string, unknown>) => ({
            artifactId: artifactId,
            testTitle: truncateString(result.testTitle as string, 500) || 'Unknown Test',
            fullTitle: truncateString(result.fullTitle as string, 1000) || 'Unknown Test',
            status: result.status as 'passed' | 'failed' | 'skipped' | 'timedOut',
            duration: result.duration as number,
            filePath: truncateString(result.filePath as string, 1000) || 'unknown',
            projectName: truncateString(result.projectName as string, 255),
            retryAttempt: (result.retryAttempt as number) || 0,
            errorMessage: truncateString(result.errorMessage as string, 5000),
            errorStack: truncateString(result.errorStack as string, 10000),
            browser: truncateString(result.browser as string, 100),
          })
        );
        await playwrightTestResultsRepository.createTestResults(inputs);
      }
    } else if (frameworkType === 'cypress') {
      // Batch insert Cypress test results via repository
      if (testResults.length > 0) {
        const inputs: CreateCypressTestResultInput[] = testResults.map(
          (result: Record<string, unknown>) => ({
            artifactId: artifactId,
            testUuid: (result.testUuid as string) || '',
            testTitle: truncateString(result.testTitle as string, 500) || 'Unknown Test',
            fullTitle: truncateString(result.fullTitle as string, 1000) || 'Unknown Test',
            state: result.status as 'passed' | 'failed' | 'pending', // Cypress uses 'state' instead of 'status'
            duration: result.duration as number,
            specFile: truncateString(result.filePath as string, 1000) || 'unknown',
            suiteUuid: (result.suiteUuid as string) || undefined,
            parentUuid: (result.parentUuid as string) || undefined,
            code: truncateString(result.code as string, 10000),
            errorMessage: truncateString(result.errorMessage as string, 5000),
            errorName: truncateString(result.errorName as string, 255),
            speed: (result.speed as 'slow' | 'medium' | 'fast') || undefined,
          })
        );
        await cypressTestResultsRepository.createTestResults(inputs);
      }
    }

    // 6. Update artifact with success status
    const processingDurationMs = Date.now() - startTime;
    await testArtifactsRepository.updateProcessingStatus(artifactId, 'processed', {
      frameworkVersion: frameworkVersion || undefined,
      durationMs: processingDurationMs,
    });
  } catch (error) {
    // 7. Update artifact with failed status and error message
    const processingDurationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    await testArtifactsRepository.updateProcessingStatus(artifactId, 'failed', {
      error: errorMessage,
      durationMs: processingDurationMs,
    });

    // Re-throw to allow caller to handle if needed
    throw error;
  }
}

/**
 * Trigger artifact processing in fire-and-forget mode
 * This allows the API response to return immediately while processing happens in background
 * @param artifactId - UUID of the artifact to process
 */
export function triggerProcessing(artifactId: string): void {
  // Fire-and-forget: don't await the promise
  processArtifact(artifactId).catch((error) => {
    // Suppress console logs in tests to avoid noise
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.error(`Background processing failed for artifact ${artifactId}:`, error);
    }
  });
}
