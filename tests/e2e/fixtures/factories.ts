/**
 * Test Data Factories for Playwright Tests
 *
 * Provides factory functions to create test data with sensible defaults.
 * Uses test data from /test-run and /test-data folders.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../lib/db/schema';
import * as fs from 'fs/promises';
import * as path from 'path';

type DrizzleDB = ReturnType<typeof drizzle>;

/**
 * Factory for creating test users
 */
export async function createTestUser(
  db: DrizzleDB,
  overrides?: Partial<typeof schema.users.$inferInsert>
): Promise<typeof schema.users.$inferSelect> {
  const defaultUser: typeof schema.users.$inferInsert = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    emailVerified: new Date(),
    ...overrides,
  };

  const [user] = await db.insert(schema.users).values(defaultUser).returning();
  return user;
}

/**
 * Loads test artifact from file system
 */
async function loadTestArtifact(filePath: string): Promise<object> {
  const fullPath = path.resolve(process.cwd(), filePath);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Factory for creating Playwright test artifacts
 *
 * @param db - Database instance
 * @param source - Source of test data: 'test-run' (fast API tests) or 'test-data' (realistic E2E tests)
 * @param overrides - Override default values
 */
export async function createPlaywrightArtifact(
  db: DrizzleDB,
  source: 'test-run' | 'test-data' = 'test-run',
  overrides?: Partial<typeof schema.testArtifacts.$inferInsert>
): Promise<typeof schema.testArtifacts.$inferSelect> {
  // Load artifact from appropriate folder
  const artifactPath =
    source === 'test-run'
      ? 'test-run/playwright/results/json/test-results.json'
      : 'test-data/playwright.json';

  const artifact = await loadTestArtifact(artifactPath);

  const defaultArtifact: typeof schema.testArtifacts.$inferInsert = {
    framework: 'playwright',
    artifact,
    processingStatus: 'pending',
    frameworkVersion: '1.56.0',
    githubRepository: 'saturninoabril/test-platform',
    githubSha: '0'.repeat(40), // Valid 40-char SHA
    githubRef: 'refs/heads/main',
    githubActor: 'test-user',
    githubRunNumber: 1,
    githubRunAttempt: 1,
    ...overrides,
  };

  const [testArtifact] = await db.insert(schema.testArtifacts).values(defaultArtifact).returning();
  return testArtifact;
}

/**
 * Factory for creating Cypress test artifacts
 *
 * @param db - Database instance
 * @param source - Source of test data: 'test-run' (fast API tests) or 'test-data' (realistic E2E tests)
 * @param overrides - Override default values
 */
export async function createCypressArtifact(
  db: DrizzleDB,
  source: 'test-run' | 'test-data' = 'test-run',
  overrides?: Partial<typeof schema.testArtifacts.$inferInsert>
): Promise<typeof schema.testArtifacts.$inferSelect> {
  // Load artifact from appropriate folder
  const artifactPath =
    source === 'test-run'
      ? 'test-run/cypress/results/mochawesome-report/mochawesome.json'
      : 'test-data/cypress.json';

  const artifact = await loadTestArtifact(artifactPath);

  const defaultArtifact: typeof schema.testArtifacts.$inferInsert = {
    framework: 'cypress',
    artifact,
    processingStatus: 'pending',
    frameworkVersion: 'Cypress 13.6.0',
    githubRepository: 'saturninoabril/test-platform',
    githubSha: '0'.repeat(40), // Valid 40-char SHA
    githubRef: 'refs/heads/main',
    githubActor: 'test-user',
    githubRunNumber: 1,
    githubRunAttempt: 1,
    ...overrides,
  };

  const [testArtifact] = await db.insert(schema.testArtifacts).values(defaultArtifact).returning();
  return testArtifact;
}

/**
 * Factory for creating Playwright test results
 */
export async function createPlaywrightTestResult(
  db: DrizzleDB,
  artifactId: string,
  overrides?: Partial<typeof schema.playwrightTestResults.$inferInsert>
): Promise<typeof schema.playwrightTestResults.$inferSelect> {
  const defaultResult: typeof schema.playwrightTestResults.$inferInsert = {
    artifactId,
    testTitle: 'Sample test',
    fullTitle: 'Sample suite > Sample test',
    status: 'passed',
    duration: 1000,
    filePath: 'tests/sample.spec.ts',
    projectName: 'chromium',
    retryAttempt: 0,
    browser: 'chromium',
    ...overrides,
  };

  const [result] = await db.insert(schema.playwrightTestResults).values(defaultResult).returning();
  return result;
}

/**
 * Factory for creating Cypress test results
 */
export async function createCypressTestResult(
  db: DrizzleDB,
  artifactId: string,
  overrides?: Partial<typeof schema.cypressTestResults.$inferInsert>
): Promise<typeof schema.cypressTestResults.$inferSelect> {
  const defaultResult: typeof schema.cypressTestResults.$inferInsert = {
    artifactId,
    testUuid: `uuid-${Date.now()}-${Math.random()}`,
    testTitle: 'Sample test',
    fullTitle: 'Sample suite > Sample test',
    state: 'passed',
    duration: 1000,
    specFile: 'cypress/e2e/sample.cy.ts',
    ...overrides,
  };

  const [result] = await db.insert(schema.cypressTestResults).values(defaultResult).returning();
  return result;
}

/**
 * Factory for creating API events
 */
export async function createApiEvent(
  db: DrizzleDB,
  overrides?: Partial<typeof schema.apiEvents.$inferInsert>
): Promise<typeof schema.apiEvents.$inferSelect> {
  const requestTime = new Date();
  const responseTime = new Date(requestTime.getTime() + 150); // 150ms later

  const defaultEvent: typeof schema.apiEvents.$inferInsert = {
    method: 'POST',
    endpoint: '/api/test-reports',
    statusCode: 201,
    requestTimestamp: requestTime,
    responseTimestamp: responseTime,
    durationMs: 150,
    authenticationStatus: 'authenticated',
    jwtSubject: 'test-user',
    jwtRoles: 'admin,write:reports',
    sourceIdentifier: '127.0.0.1',
    requestPayload: { framework: 'playwright' },
    responsePayload: { success: true },
    requestPayloadSize: 100,
    responsePayloadSize: 50,
    ...overrides,
  };

  const [event] = await db.insert(schema.apiEvents).values(defaultEvent).returning();
  return event;
}

/**
 * Batch factory for creating multiple test artifacts with results
 */
export async function createTestArtifactsWithResults(
  db: DrizzleDB,
  count: number,
  framework: 'playwright' | 'cypress',
  source: 'test-run' | 'test-data' = 'test-run'
): Promise<Array<typeof schema.testArtifacts.$inferSelect>> {
  const artifacts = [];

  for (let i = 0; i < count; i++) {
    const artifact =
      framework === 'playwright'
        ? await createPlaywrightArtifact(db, source, {
            githubRunNumber: i + 1,
            processingStatus: 'processed',
          })
        : await createCypressArtifact(db, source, {
            githubRunNumber: i + 1,
            processingStatus: 'processed',
          });

    // Create some test results for each artifact
    if (framework === 'playwright') {
      await createPlaywrightTestResult(db, artifact.id, {
        status: 'passed',
        testTitle: `Test ${i + 1} - passed`,
      });
      await createPlaywrightTestResult(db, artifact.id, {
        status: 'failed',
        testTitle: `Test ${i + 1} - failed`,
        errorMessage: 'Expected value to be true',
      });
    } else {
      await createCypressTestResult(db, artifact.id, {
        state: 'passed',
        testTitle: `Test ${i + 1} - passed`,
      });
      await createCypressTestResult(db, artifact.id, {
        state: 'failed',
        testTitle: `Test ${i + 1} - failed`,
        errorMessage: 'Expected value to be true',
      });
    }

    artifacts.push(artifact);
  }

  return artifacts;
}
