import 'server-only';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { cypressTestResults } from '../schema';
import { BaseRepository } from './base.repository';
import type { DrizzleTransaction, PaginatedResult } from './types';
import { ValidationError } from '../../errors/database-errors';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const createCypressTestResultSchema = z.object({
  artifactId: z.string().uuid({
    message: 'Artifact ID must be a valid UUID',
  }),
  testUuid: z.string().uuid({
    message: 'Test UUID must be a valid UUID',
  }),
  testTitle: z.string().min(1).max(500, {
    message: 'Test title must be between 1 and 500 characters',
  }),
  fullTitle: z.string().min(1).max(1000, {
    message: 'Full title must be between 1 and 1000 characters',
  }),
  state: z.enum(['passed', 'failed', 'pending'], {
    message: 'State must be one of: passed, failed, pending',
  }),
  duration: z.number().int().nonnegative().max(3600000, {
    message: 'Duration must be between 0 and 3600000 ms (1 hour)',
  }),
  specFile: z.string().min(1).max(1000, {
    message: 'Spec file must be between 1 and 1000 characters',
  }),
  suiteUuid: z.string().uuid().optional(),
  parentUuid: z.string().uuid().optional(),
  code: z.string().max(10000).optional(),
  errorMessage: z.string().max(5000).optional(),
  errorName: z.string().max(255).optional(),
  speed: z.enum(['slow', 'medium', 'fast']).optional(),
});

const listCypressTestResultsSchema = z.object({
  artifactId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  state: z.string().optional(),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type CreateCypressTestResultInput = z.infer<typeof createCypressTestResultSchema>;
export type ListCypressTestResultsInput = z.infer<typeof listCypressTestResultsSchema>;

// ============================================================================
// DTO
// ============================================================================

export interface CypressTestResultDTO {
  id: string;
  artifactId: string;
  testUuid: string;
  testTitle: string;
  fullTitle: string;
  state: string;
  duration: number;
  specFile: string;
  suiteUuid: string | null;
  parentUuid: string | null;
  code: string | null;
  errorMessage: string | null;
  errorName: string | null;
  speed: string | null;
  createdAt: Date;
}

// ============================================================================
// Repository Class
// ============================================================================

class CypressTestResultsRepository extends BaseRepository {
  private toDTO(row: typeof cypressTestResults.$inferSelect): CypressTestResultDTO {
    return {
      id: row.id,
      artifactId: row.artifactId,
      testUuid: row.testUuid,
      testTitle: row.testTitle,
      fullTitle: row.fullTitle,
      state: row.state,
      duration: row.duration,
      specFile: row.specFile,
      suiteUuid: row.suiteUuid,
      parentUuid: row.parentUuid,
      code: row.code,
      errorMessage: row.errorMessage,
      errorName: row.errorName,
      speed: row.speed,
      createdAt: row.createdAt,
    };
  }

  async listResults(
    params: ListCypressTestResultsInput,
    tx?: DrizzleTransaction
  ): Promise<PaginatedResult<CypressTestResultDTO>> {
    return this.executeQuery(async () => {
      const validated = listCypressTestResultsSchema.parse(params);
      const { artifactId, page, pageSize, state } = validated;

      const db = this.getDb(tx);

      const conditions = [eq(cypressTestResults.artifactId, artifactId)];
      if (state) {
        conditions.push(eq(cypressTestResults.state, state));
      }

      const whereClause = and(...conditions);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cypressTestResults)
        .where(whereClause);

      const totalCount = countResult?.count || 0;

      const offset = this.calculateOffset(page, pageSize);
      const rows = await db
        .select()
        .from(cypressTestResults)
        .where(whereClause)
        .orderBy(desc(cypressTestResults.createdAt))
        .limit(pageSize)
        .offset(offset);

      return {
        data: rows.map((row) => this.toDTO(row)),
        pagination: this.buildPagination({ page, pageSize, totalCount }),
      };
    });
  }

  async getResultById(id: string, tx?: DrizzleTransaction): Promise<CypressTestResultDTO | null> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);
      const [row] = await db.select().from(cypressTestResults).where(eq(cypressTestResults.id, id));

      return row ? this.toDTO(row) : null;
    });
  }

  async createTestResult(
    input: CreateCypressTestResultInput,
    tx?: DrizzleTransaction
  ): Promise<CypressTestResultDTO> {
    return this.executeQuery(async () => {
      const validated = createCypressTestResultSchema.parse(input);
      const db = this.getDb(tx);

      const [created] = await db.insert(cypressTestResults).values(validated).returning();

      if (!created) {
        throw new ValidationError('Failed to create Cypress test result');
      }

      return this.toDTO(created);
    });
  }

  async createTestResults(
    inputs: CreateCypressTestResultInput[],
    tx?: DrizzleTransaction
  ): Promise<CypressTestResultDTO[]> {
    return this.executeQuery(async () => {
      const validated = inputs.map((input) => createCypressTestResultSchema.parse(input));
      const db = this.getDb(tx);

      const created = await db.insert(cypressTestResults).values(validated).returning();

      return created.map((row) => this.toDTO(row));
    });
  }

  async deleteByArtifactId(artifactId: string, tx?: DrizzleTransaction): Promise<number> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);

      const [result] = await db
        .delete(cypressTestResults)
        .where(eq(cypressTestResults.artifactId, artifactId))
        .returning({ id: cypressTestResults.id });

      return result ? 1 : 0;
    });
  }
}

export const cypressTestResultsRepository = new CypressTestResultsRepository();
