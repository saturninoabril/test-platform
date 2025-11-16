import 'server-only';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { playwrightTestResults } from '../schema';
import { BaseRepository } from './base.repository';
import type { DrizzleTransaction, PaginatedResult } from './types';
import { ValidationError } from '../../errors/database-errors';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createPlaywrightTestResultSchema = z.object({
  artifactId: z.string().uuid({
    message: 'Artifact ID must be a valid UUID',
  }),
  testTitle: z.string().min(1).max(500, {
    message: 'Test title must be between 1 and 500 characters',
  }),
  fullTitle: z.string().min(1).max(1000, {
    message: 'Full title must be between 1 and 1000 characters',
  }),
  status: z.enum(['passed', 'failed', 'skipped', 'timedOut'], {
    message: 'Status must be one of: passed, failed, skipped, timedOut',
  }),
  duration: z.number().int().nonnegative().max(3600000, {
    message: 'Duration must be between 0 and 3600000 ms (1 hour)',
  }),
  filePath: z.string().min(1).max(1000, {
    message: 'File path must be between 1 and 1000 characters',
  }),
  projectName: z.string().max(255).optional(),
  browser: z.string().max(100).optional(),
  retryAttempt: z
    .number()
    .int()
    .nonnegative()
    .max(10, {
      message: 'Retry attempt must be between 0 and 10',
    })
    .default(0),
  errorMessage: z.string().max(5000).optional(),
  errorStack: z.string().max(10000).optional(),
});

const listPlaywrightTestResultsSchema = z.object({
  artifactId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type CreatePlaywrightTestResultInput = z.infer<typeof createPlaywrightTestResultSchema>;
export type ListPlaywrightTestResultsInput = z.infer<typeof listPlaywrightTestResultsSchema>;

// ============================================================================
// DTO
// ============================================================================

export interface PlaywrightTestResultDTO {
  id: string;
  artifactId: string;
  testTitle: string;
  fullTitle: string;
  status: string;
  duration: number;
  filePath: string;
  projectName: string | null;
  browser: string | null;
  retryAttempt: number;
  errorMessage: string | null;
  errorStack: string | null;
  createdAt: Date;
}

// ============================================================================
// Repository Class
// ============================================================================

class PlaywrightTestResultsRepository extends BaseRepository {
  private toDTO(row: typeof playwrightTestResults.$inferSelect): PlaywrightTestResultDTO {
    return {
      id: row.id,
      artifactId: row.artifactId,
      testTitle: row.testTitle,
      fullTitle: row.fullTitle,
      status: row.status,
      duration: row.duration,
      filePath: row.filePath,
      projectName: row.projectName,
      browser: row.browser,
      retryAttempt: row.retryAttempt,
      errorMessage: row.errorMessage,
      errorStack: row.errorStack,
      createdAt: row.createdAt,
    };
  }

  async listResults(
    params: ListPlaywrightTestResultsInput,
    tx?: DrizzleTransaction
  ): Promise<PaginatedResult<PlaywrightTestResultDTO>> {
    return this.executeQuery(async () => {
      const validated = listPlaywrightTestResultsSchema.parse(params);
      const { artifactId, page, pageSize, status } = validated;

      const db = this.getDb(tx);

      const conditions = [eq(playwrightTestResults.artifactId, artifactId)];
      if (status) {
        conditions.push(eq(playwrightTestResults.status, status));
      }

      const whereClause = and(...conditions);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playwrightTestResults)
        .where(whereClause);

      const totalCount = countResult?.count || 0;

      const offset = this.calculateOffset(page, pageSize);
      const rows = await db
        .select()
        .from(playwrightTestResults)
        .where(whereClause)
        .orderBy(desc(playwrightTestResults.createdAt))
        .limit(pageSize)
        .offset(offset);

      return {
        data: rows.map((row) => this.toDTO(row)),
        pagination: this.buildPagination({ page, pageSize, totalCount }),
      };
    });
  }

  async getResultById(
    id: string,
    tx?: DrizzleTransaction
  ): Promise<PlaywrightTestResultDTO | null> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);
      const [row] = await db
        .select()
        .from(playwrightTestResults)
        .where(eq(playwrightTestResults.id, id));

      return row ? this.toDTO(row) : null;
    });
  }

  async createTestResult(
    input: CreatePlaywrightTestResultInput,
    tx?: DrizzleTransaction
  ): Promise<PlaywrightTestResultDTO> {
    return this.executeQuery(async () => {
      const validated = createPlaywrightTestResultSchema.parse(input);
      const db = this.getDb(tx);

      const [created] = await db.insert(playwrightTestResults).values(validated).returning();

      if (!created) {
        throw new ValidationError('Failed to create Playwright test result');
      }

      return this.toDTO(created);
    });
  }

  async createTestResults(
    inputs: CreatePlaywrightTestResultInput[],
    tx?: DrizzleTransaction
  ): Promise<PlaywrightTestResultDTO[]> {
    return this.executeQuery(async () => {
      const validated = inputs.map((input) => createPlaywrightTestResultSchema.parse(input));
      const db = this.getDb(tx);

      const created = await db.insert(playwrightTestResults).values(validated).returning();

      return created.map((row) => this.toDTO(row));
    });
  }

  async deleteByArtifactId(artifactId: string, tx?: DrizzleTransaction): Promise<number> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);

      const [result] = await db
        .delete(playwrightTestResults)
        .where(eq(playwrightTestResults.artifactId, artifactId))
        .returning({ id: playwrightTestResults.id });

      return result ? 1 : 0;
    });
  }
}

export const playwrightTestResultsRepository = new PlaywrightTestResultsRepository();
