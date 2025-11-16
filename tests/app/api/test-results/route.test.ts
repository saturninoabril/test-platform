/**
 * Test Results API Endpoint Tests (Vitest)
 *
 * Tests for test results endpoints that provide access to processed test data:
 * - GET /api/test-results/[artifactId] - List paginated test results
 * - GET /api/test-results/[artifactId]/summary - Get summary statistics
 * - GET /api/test-results/[artifactId]/search - Search test files/names
 * - GET /api/test-results/[artifactId]/files - Get file-level summaries
 * - GET /api/test-results/[artifactId]/files/tests - Get test details for specific files
 *
 * All endpoints are public (no authentication required) and work with processed artifacts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  setupTestDatabase,
  createCommittedTestDatabase,
  type CommittedTestDb,
} from '../../../helpers/test-database';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Setup database with transaction rollback for test isolation
const testDb = setupTestDatabase();

beforeAll(testDb.beforeAll);
beforeEach(testDb.beforeEach);
afterEach(testDb.afterEach);
afterAll(testDb.afterAll);

// Helper to create a processed Playwright artifact with test results
async function createProcessedPlaywrightArtifact(committedDb: CommittedTestDb) {
  const artifactId = crypto.randomUUID();

  // Create processed artifact with proper Playwright structure (needs config for framework detection)
  await committedDb.db.insert(schema.testArtifacts).values({
    id: artifactId,
    framework: 'playwright',
    artifact: {
      config: {
        configFile: '/path/to/playwright.config.ts',
        rootDir: '/path/to/project',
      },
      status: 'passed',
      startTime: '2024-01-01T00:00:00.000Z',
      duration: 10000,
      suites: [{ title: 'Test Suite', tests: [] }],
    },
    processingStatus: 'processed',
    processedAt: new Date(),
    frameworkVersion: 'Playwright 1.40.0',
    githubRepository: 'owner/repo',
    githubSha: 'a'.repeat(40),
    githubActor: 'test-actor',
    githubRunNumber: 123,
    githubRunAttempt: 1,
  });

  // Create test results
  await committedDb.db.insert(schema.playwrightTestResults).values([
    {
      id: crypto.randomUUID(),
      artifactId,
      testTitle: 'should pass test 1',
      fullTitle: 'Suite A › should pass test 1',
      status: 'passed',
      duration: 100,
      filePath: 'tests/suite-a.spec.ts',
      projectName: 'chromium',
      retryAttempt: 0,
      browser: 'chromium',
    },
    {
      id: crypto.randomUUID(),
      artifactId,
      testTitle: 'should fail test 2',
      fullTitle: 'Suite A › should fail test 2',
      status: 'failed',
      duration: 200,
      filePath: 'tests/suite-a.spec.ts',
      projectName: 'chromium',
      retryAttempt: 0,
      browser: 'chromium',
      errorMessage: 'Expected true to be false',
    },
    {
      id: crypto.randomUUID(),
      artifactId,
      testTitle: 'should pass test 3',
      fullTitle: 'Suite B › should pass test 3',
      status: 'passed',
      duration: 150,
      filePath: 'tests/suite-b.spec.ts',
      projectName: 'firefox',
      retryAttempt: 0,
      browser: 'firefox',
    },
  ]);

  return artifactId;
}

describe('GET /api/test-results/[artifactId]', () => {
  it('should return 400 for invalid UUID format', async () => {
    const response = await fetch(`${BASE_URL}/api/test-results/not-a-uuid`);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid artifact ID format');
  });

  it('should return 404 for non-existent artifact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${BASE_URL}/api/test-results/${fakeId}`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return 400 if artifact not processed yet', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const [artifact] = await committedDb.db
        .insert(schema.testArtifacts)
        .values({
          id: crypto.randomUUID(),
          framework: 'playwright',
          artifact: { suites: [] },
          processingStatus: 'pending', // Not processed yet
          githubRepository: 'owner/repo',
          githubSha: 'b'.repeat(40),
          githubActor: 'test-actor',
          githubRunNumber: 456,
          githubRunAttempt: 1,
        })
        .returning();

      const response = await fetch(`${BASE_URL}/api/test-results/${artifact.id}`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('not processed');
      expect(data.processingStatus).toBe('pending');

      // Cleanup
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifact.id));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should return paginated test results for processed Playwright artifact', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}?page=1&pageSize=10`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('pageSize');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should support status filtering', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}?status=passed`);

      expect(response.status).toBe(200);
      const data = await response.json();

      // All returned results should have passed status
      if (data.data.length > 0) {
        data.data.forEach((result: { status: string }) => {
          expect(result.status).toBe('passed');
        });
      }

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('GET /api/test-results/[artifactId]/summary', () => {
  it('should return 400 for invalid UUID format', async () => {
    const response = await fetch(`${BASE_URL}/api/test-results/not-a-uuid/summary`);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid artifact ID format');
  });

  it('should return 404 for non-existent artifact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${BASE_URL}/api/test-results/${fakeId}/summary`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return summary statistics for processed artifact', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}/summary`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(data.frameworkVersion).toBe('Playwright 1.40.0');
      expect(data.processingStatus).toBe('processed');
      expect(data).toHaveProperty('statistics');
      expect(data.statistics).toHaveProperty('total');
      expect(data.statistics).toHaveProperty('passed');
      expect(data.statistics).toHaveProperty('failed');
      expect(data.statistics).toHaveProperty('passRate');
      expect(data.statistics).toHaveProperty('failRate');
      expect(data).toHaveProperty('metadata');
      expect(data.metadata.githubRepository).toBe('owner/repo');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('GET /api/test-results/[artifactId]/search', () => {
  it('should return 400 for missing search query', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}/search`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('query is required');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should return 400 for invalid UUID format', async () => {
    const response = await fetch(`${BASE_URL}/api/test-results/not-a-uuid/search?q=test`);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid artifact ID format');
  });

  it('should return 404 for non-existent artifact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${BASE_URL}/api/test-results/${fakeId}/search?q=test`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should search test files and names', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}/search?q=suite-a`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(data.query).toBe('suite-a');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data).toHaveProperty('pagination');

      // Should find files matching the search
      if (data.data.length > 0) {
        expect(data.data[0].filePath).toContain('suite-a');
      }

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should support pagination in search results', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(
        `${BASE_URL}/api/test-results/${artifactId}/search?q=test&page=1&pageSize=10`
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.pagination).toHaveProperty('page', 1);
      expect(data.pagination).toHaveProperty('pageSize', 10);
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('totalFiles');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('GET /api/test-results/[artifactId]/files', () => {
  it('should return 400 for invalid UUID format', async () => {
    const response = await fetch(`${BASE_URL}/api/test-results/not-a-uuid/files`);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid artifact ID format');
  });

  it('should return 404 for non-existent artifact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${BASE_URL}/api/test-results/${fakeId}/files`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return file-level summaries for processed artifact', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}/files`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('statistics');
      expect(data.statistics).toHaveProperty('totalFiles');
      expect(data.statistics).toHaveProperty('passedFiles');
      expect(data.statistics).toHaveProperty('failedFiles');

      // Each file should have test counts
      if (data.data.length > 0) {
        const file = data.data[0];
        expect(file).toHaveProperty('filePath');
        expect(file).toHaveProperty('totalTests');
        expect(file).toHaveProperty('passedTests');
        expect(file).toHaveProperty('failedTests');
        expect(file).toHaveProperty('totalDuration');
      }

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should support status filtering for files', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(
        `${BASE_URL}/api/test-results/${artifactId}/files?status=failed`
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only return files with failed tests
      if (data.data.length > 0) {
        data.data.forEach((file: { failedTests: number }) => {
          expect(file.failedTests).toBeGreaterThan(0);
        });
      }

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should support pagination for file listings', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(
        `${BASE_URL}/api/test-results/${artifactId}/files?page=1&pageSize=10`
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.pagination.page).toBe(1);
      expect(data.pagination.pageSize).toBe(10);
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('hasNextPage');
      expect(data.pagination).toHaveProperty('hasPreviousPage');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('GET /api/test-results/[artifactId]/files/tests', () => {
  it('should return 400 for missing files parameter', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(`${BASE_URL}/api/test-results/${artifactId}/files/tests`);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('files parameter');

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should return 400 for invalid UUID format', async () => {
    const response = await fetch(
      `${BASE_URL}/api/test-results/not-a-uuid/files/tests?files=test.spec.ts`
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid artifact ID format');
  });

  it('should return 404 for non-existent artifact', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(
      `${BASE_URL}/api/test-results/${fakeId}/files/tests?files=test.spec.ts`
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('should return test details for specific files', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(
        `${BASE_URL}/api/test-results/${artifactId}/files/tests?files=tests/suite-a.spec.ts`
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(Array.isArray(data.data)).toBe(true);

      // All results should be from the requested file
      if (data.data.length > 0) {
        data.data.forEach(
          (test: { filePath: string; testTitle: string; status: string; duration: number }) => {
            expect(test.filePath).toBe('tests/suite-a.spec.ts');
            expect(test).toHaveProperty('testTitle');
            expect(test).toHaveProperty('status');
            expect(test).toHaveProperty('duration');
          }
        );
      }

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should support multiple files in comma-separated format', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const artifactId = await createProcessedPlaywrightArtifact(committedDb);

      const response = await fetch(
        `${BASE_URL}/api/test-results/${artifactId}/files/tests?files=tests/suite-a.spec.ts,tests/suite-b.spec.ts`
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.framework).toBe('playwright');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      // Should include tests from both files
      const filePaths = [...new Set(data.data.map((test: { filePath: string }) => test.filePath))];
      expect(filePaths.length).toBeGreaterThan(1);

      // Cleanup
      await committedDb.db
        .delete(schema.playwrightTestResults)
        .where(eq(schema.playwrightTestResults.artifactId, artifactId));
      await committedDb.db
        .delete(schema.testArtifacts)
        .where(eq(schema.testArtifacts.id, artifactId));
    } finally {
      await committedDb.cleanup();
    }
  });
});
