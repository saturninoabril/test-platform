/**
 * Playwright Custom Fixtures
 *
 * Combines database, authentication, and factory fixtures into a unified test context.
 * All tests automatically get:
 * - Database transaction (auto-rollback after test)
 * - Authentication helpers
 * - Test data factories
 *
 * Usage:
 * ```typescript
 * import { test, expect } from './fixtures';
 *
 * test('should create test artifact', async ({ testDb, auth, factories }) => {
 *   const authContext = auth.admin();
 *   const artifact = await factories.createPlaywrightArtifact(testDb.db);
 *
 *   expect(artifact.id).toBeDefined();
 * });
 * ```
 */

import { test as base, Page } from '@playwright/test';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestPool, beginTransaction, rollbackTransaction, TestDatabase } from './database';
import { TestUsers, createAuthContext, generateTestJWT } from './auth';
import * as factories from './factories';
import * as schema from '../../../lib/db/schema';

// Committed database interface (for HTTP-visible data)
export interface CommittedDatabase {
  db: NodePgDatabase<Record<string, unknown>> & { $client: Pool };
  pool: Pool;
}

// Extend Playwright fixtures with our custom fixtures
export interface CustomFixtures {
  /** Database with active transaction (auto-rollback after test) */
  testDb: TestDatabase;

  /** Committed database (for E2E tests that need HTTP-visible data) */
  committedDb: CommittedDatabase;

  /** Database pool (shared across tests) */
  testPool: Pool;

  /** Authentication helpers */
  auth: {
    /** Predefined test users */
    users: typeof TestUsers;
    /** Create custom auth context */
    createContext: typeof createAuthContext;
    /** Generate JWT token */
    generateJWT: typeof generateTestJWT;
  };

  /** Test data factories */
  factories: typeof factories;
}

// Global pool instance (created once, reused across all tests)
let globalTestPool: Pool | undefined;

/**
 * Extended Playwright test with custom fixtures
 */
export const test = base.extend<CustomFixtures>({
  // Database pool fixture (test-scoped for now, can be optimized to worker-scoped later)
  testPool: async ({}, use) => {
    if (!globalTestPool) {
      globalTestPool = createTestPool();
    }
    await use(globalTestPool);
    // Don't close pool here - it's closed in global teardown
  },

  // Database transaction fixture (test-scoped, auto-rollback)
  testDb: async ({ testPool }, use) => {
    const testDb = await beginTransaction(testPool);
    await use(testDb);
    await rollbackTransaction(testDb);
  },

  // Committed database fixture (for E2E tests that need HTTP-visible data)
  committedDb: async ({ testPool }, use) => {
    const db = drizzle(testPool, { schema });
    // Add $client property for type compatibility with factories
    (db as NodePgDatabase<Record<string, unknown>> & { $client: Pool }).$client = testPool;

    // Clean database before test to ensure isolation
    // Use TRUNCATE CASCADE for atomic cleanup
    await testPool.query('TRUNCATE TABLE test_artifacts CASCADE');

    await use({
      db: db as NodePgDatabase<Record<string, unknown>> & { $client: Pool },
      pool: testPool,
    });

    // Clean up all data after test
    await testPool.query('TRUNCATE TABLE test_artifacts CASCADE');
  },

  // Authentication fixture
  auth: async ({}, use) => {
    await use({
      users: TestUsers,
      createContext: createAuthContext,
      generateJWT: generateTestJWT,
    });
  },

  // Factories fixture
  factories: async ({}, use) => {
    await use(factories);
  },
});

/**
 * Re-export expect from Playwright
 */
export { expect } from '@playwright/test';

/**
 * API Request helpers for authenticated requests
 */
export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: object;
  headers?: Record<string, string>;
  authToken?: string;
}

/**
 * Helper to make authenticated API requests in tests
 */
export async function makeApiRequest(
  page: Page,
  options: ApiRequestOptions
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const { method, endpoint, body, headers = {}, authToken } = options;

  const allHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authToken) {
    allHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await page.request.fetch(endpoint, {
    method,
    headers: allHeaders,
    data: body,
  });

  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text();
  }

  const responseHeaders: Record<string, string> = {};
  const headersEntries = response.headers();
  Object.entries(headersEntries).forEach(([key, value]) => {
    responseHeaders[key] = value;
  });

  return {
    status: response.status(),
    body: responseBody,
    headers: responseHeaders,
  };
}

/**
 * Helper to wait for background processing to complete
 *
 * Polls database until artifact processing status changes from 'pending'
 */
export async function waitForProcessing(
  testDb: TestDatabase,
  artifactId: string,
  timeoutMs: number = 10000
): Promise<{ processingStatus: string; processingError: string | null }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await testDb.client.query(
      'SELECT processing_status, processing_error FROM test_artifacts WHERE id = $1',
      [artifactId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const { processing_status, processing_error } = result.rows[0];

    if (processing_status !== 'pending' && processing_status !== 'processing') {
      return {
        processingStatus: processing_status,
        processingError: processing_error,
      };
    }

    // Wait 100ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for artifact ${artifactId} to complete processing`);
}

/**
 * Cleanup function for global teardown
 */
export async function closeGlobalTestPool(): Promise<void> {
  if (globalTestPool) {
    await globalTestPool.end();
    globalTestPool = undefined;
  }
}
