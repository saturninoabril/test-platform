import 'server-only';
import { z } from 'zod';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { testArtifacts, playwrightTestResults, cypressTestResults } from '../schema';
import { BaseRepository } from './base.repository';
import type { DrizzleTransaction, PaginatedResult } from './types';
import { ValidationError } from '../../errors/database-errors';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Maximum artifact payload size (10 MB)
 */
const MAX_ARTIFACT_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

/**
 * Schema for creating test artifacts
 * Validates all input before database insertion with comprehensive checks
 */
const createTestArtifactSchema = z.object({
  // Framework validation - must be one of the supported frameworks
  framework: z.enum(['playwright', 'cypress', 'jest'], {
    message: 'Framework must be one of: playwright, cypress, jest',
  }),

  // Artifact validation - must be a valid JSON object with size limits
  artifact: z
    .record(z.string(), z.unknown())
    .refine(
      (val) => {
        const size = JSON.stringify(val).length;
        return size <= MAX_ARTIFACT_SIZE;
      },
      {
        message: `Artifact size must not exceed ${MAX_ARTIFACT_SIZE} bytes (10 MB)`,
      }
    )
    .refine(
      (val) => {
        // Basic structure validation - artifact should have some content
        return Object.keys(val).length > 0;
      },
      {
        message: 'Artifact must contain at least one property',
      }
    ),

  // Optional GitHub metadata with format validation
  githubRepository: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/, {
      message: 'GitHub repository must be in format: owner/repo',
    })
    .optional(),
  githubSha: z
    .string()
    .regex(/^[a-f0-9]{40}$/, {
      message: 'GitHub SHA must be a valid 40-character hex string',
    })
    .optional(),
  githubHeadRef: z.string().max(255).optional(),
  githubBaseRef: z.string().max(255).optional(),
  githubRef: z.string().max(255).optional(),
  githubActor: z.string().max(255).optional(),
  githubRunId: z
    .string()
    .regex(/^\d+$/, {
      message: 'GitHub run ID must be a numeric string',
    })
    .optional(),
  githubRunNumber: z.number().int().positive().optional(),
  githubRunAttempt: z.number().int().positive().optional(),
  githubJob: z.string().max(255).optional(),
  runnerName: z.string().max(255).optional(),
});

/**
 * Schema for listing test artifacts with filters
 */
const listTestArtifactsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  framework: z.enum(['playwright', 'cypress', 'jest']).optional(),
  processingStatus: z.enum(['pending', 'processing', 'processed', 'failed']).optional(),
});

/**
 * Schema for updating processing status
 */
const updateProcessingStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'processed', 'failed']),
  error: z.string().optional(),
  frameworkVersion: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

export type CreateTestArtifactInput = z.infer<typeof createTestArtifactSchema>;
export type ListTestArtifactsInput = z.infer<typeof listTestArtifactsSchema>;
export type UpdateProcessingStatusInput = z.infer<typeof updateProcessingStatusSchema>;

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

/**
 * Test artifact DTO (list view)
 * Excludes large artifact field for performance
 */
export interface TestArtifactDTO {
  id: string;
  framework: string;
  frameworkVersion: string | null;
  processingStatus: string;
  processingError: string | null;
  processingDurationMs: number | null;
  processedAt: Date | null;
  githubRepository: string | null;
  githubSha: string | null;
  githubHeadRef: string | null;
  githubBaseRef: string | null;
  githubRef: string | null;
  githubActor: string | null;
  githubRunId: string | null;
  githubRunNumber: number | null;
  githubRunAttempt: number | null;
  githubJob: string | null;
  runnerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Test artifact DTO with full payload (detail view)
 * Includes complete artifact JSON
 */
export interface TestArtifactWithArtifactDTO extends TestArtifactDTO {
  artifact: Record<string, unknown>;
}

/**
 * Test summary statistics aggregated from test results
 */
export interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  duration: number; // Total duration in milliseconds
  passRate: number; // Pass rate as percentage (0-100)
}

// ============================================================================
// Repository Class
// ============================================================================

class TestArtifactsRepository extends BaseRepository {
  /**
   * Transform database row to DTO (without artifact)
   */
  private toDTO(row: typeof testArtifacts.$inferSelect): TestArtifactDTO {
    return {
      id: row.id,
      framework: row.framework,
      frameworkVersion: row.frameworkVersion,
      processingStatus: row.processingStatus,
      processingError: row.processingError,
      processingDurationMs: row.processingDurationMs,
      processedAt: row.processedAt,
      githubRepository: row.githubRepository,
      githubSha: row.githubSha,
      githubHeadRef: row.githubHeadRef,
      githubBaseRef: row.githubBaseRef,
      githubRef: row.githubRef,
      githubActor: row.githubActor,
      githubRunId: row.githubRunId,
      githubRunNumber: row.githubRunNumber,
      githubRunAttempt: row.githubRunAttempt,
      githubJob: row.githubJob,
      runnerName: row.runnerName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Transform database row to DTO with artifact
   */
  private toDTOWithArtifact(row: typeof testArtifacts.$inferSelect): TestArtifactWithArtifactDTO {
    return {
      ...this.toDTO(row),
      artifact: row.artifact as Record<string, unknown>,
    };
  }

  /**
   * List artifacts with pagination and filtering
   * Returns DTOs without full artifact payload
   */
  async listArtifacts(
    params: ListTestArtifactsInput,
    tx?: DrizzleTransaction
  ): Promise<PaginatedResult<TestArtifactDTO>> {
    return this.executeQuery(async () => {
      // Validate input
      const validated = listTestArtifactsSchema.parse(params);
      const { page, pageSize, framework, processingStatus } = validated;

      const db = this.getDb(tx);

      // Build where conditions
      const conditions = [];
      if (framework) {
        conditions.push(eq(testArtifacts.framework, framework));
      }
      if (processingStatus) {
        conditions.push(eq(testArtifacts.processingStatus, processingStatus));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(testArtifacts)
        .where(whereClause);

      const totalCount = countResult?.count || 0;

      // Get paginated data (exclude artifact field)
      const offset = this.calculateOffset(page, pageSize);
      const rows = await db
        .select({
          id: testArtifacts.id,
          framework: testArtifacts.framework,
          frameworkVersion: testArtifacts.frameworkVersion,
          processingStatus: testArtifacts.processingStatus,
          processingError: testArtifacts.processingError,
          processingDurationMs: testArtifacts.processingDurationMs,
          processedAt: testArtifacts.processedAt,
          githubRepository: testArtifacts.githubRepository,
          githubSha: testArtifacts.githubSha,
          githubHeadRef: testArtifacts.githubHeadRef,
          githubBaseRef: testArtifacts.githubBaseRef,
          githubRef: testArtifacts.githubRef,
          githubActor: testArtifacts.githubActor,
          githubRunId: testArtifacts.githubRunId,
          githubRunNumber: testArtifacts.githubRunNumber,
          githubRunAttempt: testArtifacts.githubRunAttempt,
          githubJob: testArtifacts.githubJob,
          runnerName: testArtifacts.runnerName,
          createdAt: testArtifacts.createdAt,
          updatedAt: testArtifacts.updatedAt,
        })
        .from(testArtifacts)
        .where(whereClause)
        .orderBy(desc(testArtifacts.createdAt))
        .limit(pageSize)
        .offset(offset);

      return {
        data: rows as TestArtifactDTO[],
        pagination: this.buildPagination({ page, pageSize, totalCount }),
      };
    });
  }

  /**
   * Get test summaries for a list of artifact IDs
   * Returns a map of artifactId -> summary statistics
   */
  async getSummariesForArtifacts(
    artifactIds: string[],
    tx?: DrizzleTransaction
  ): Promise<Map<string, TestSummary>> {
    return this.executeQuery(async () => {
      if (artifactIds.length === 0) {
        return new Map();
      }

      const db = this.getDb(tx);
      const summaries = new Map<string, TestSummary>();

      // Get Playwright test results
      const playwrightResults = await db
        .select({
          artifactId: playwrightTestResults.artifactId,
          totalTests: sql<number>`count(*)::int`,
          passed: sql<number>`count(*) FILTER (WHERE ${playwrightTestResults.status} = 'passed')::int`,
          failed: sql<number>`count(*) FILTER (WHERE ${playwrightTestResults.status} = 'failed')::int`,
          skipped: sql<number>`count(*) FILTER (WHERE ${playwrightTestResults.status} = 'skipped')::int`,
          timedOut: sql<number>`count(*) FILTER (WHERE ${playwrightTestResults.status} = 'timedOut')::int`,
          duration: sql<number>`sum(${playwrightTestResults.duration})::int`,
        })
        .from(playwrightTestResults)
        .where(inArray(playwrightTestResults.artifactId, artifactIds))
        .groupBy(playwrightTestResults.artifactId);

      // Get Cypress test results
      const cypressResults = await db
        .select({
          artifactId: cypressTestResults.artifactId,
          totalTests: sql<number>`count(*)::int`,
          passed: sql<number>`count(*) FILTER (WHERE ${cypressTestResults.state} = 'passed')::int`,
          failed: sql<number>`count(*) FILTER (WHERE ${cypressTestResults.state} = 'failed')::int`,
          pending: sql<number>`count(*) FILTER (WHERE ${cypressTestResults.state} = 'pending')::int`,
          duration: sql<number>`sum(${cypressTestResults.duration})::int`,
        })
        .from(cypressTestResults)
        .where(inArray(cypressTestResults.artifactId, artifactIds))
        .groupBy(cypressTestResults.artifactId);

      // Process Playwright results
      for (const result of playwrightResults) {
        const total = result.totalTests || 0;
        const passed = result.passed || 0;
        const failed = result.failed || 0;
        const skipped = result.skipped || 0;
        const timedOut = result.timedOut || 0;
        const passRate = total > 0 ? (passed / total) * 100 : 0;

        summaries.set(result.artifactId, {
          totalTests: total,
          passed,
          failed,
          skipped: skipped + timedOut, // Combine skipped and timedOut
          pending: 0,
          duration: result.duration || 0,
          passRate,
        });
      }

      // Process Cypress results
      for (const result of cypressResults) {
        const total = result.totalTests || 0;
        const passed = result.passed || 0;
        const failed = result.failed || 0;
        const pending = result.pending || 0;
        const passRate = total > 0 ? (passed / total) * 100 : 0;

        summaries.set(result.artifactId, {
          totalTests: total,
          passed,
          failed,
          skipped: 0,
          pending,
          duration: result.duration || 0,
          passRate,
        });
      }

      return summaries;
    });
  }

  /**
   * Get artifact by ID (without full payload)
   * @returns DTO or null if not found
   */
  async getArtifactById(id: string, tx?: DrizzleTransaction): Promise<TestArtifactDTO | null> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);

      const [row] = await db
        .select({
          id: testArtifacts.id,
          framework: testArtifacts.framework,
          frameworkVersion: testArtifacts.frameworkVersion,
          processingStatus: testArtifacts.processingStatus,
          processingError: testArtifacts.processingError,
          processingDurationMs: testArtifacts.processingDurationMs,
          processedAt: testArtifacts.processedAt,
          githubRepository: testArtifacts.githubRepository,
          githubSha: testArtifacts.githubSha,
          githubHeadRef: testArtifacts.githubHeadRef,
          githubBaseRef: testArtifacts.githubBaseRef,
          githubRef: testArtifacts.githubRef,
          githubActor: testArtifacts.githubActor,
          githubRunId: testArtifacts.githubRunId,
          githubRunNumber: testArtifacts.githubRunNumber,
          githubRunAttempt: testArtifacts.githubRunAttempt,
          githubJob: testArtifacts.githubJob,
          runnerName: testArtifacts.runnerName,
          createdAt: testArtifacts.createdAt,
          updatedAt: testArtifacts.updatedAt,
        })
        .from(testArtifacts)
        .where(eq(testArtifacts.id, id));

      return row ? (row as TestArtifactDTO) : null;
    });
  }

  /**
   * Get artifact by ID with full artifact payload
   * @returns DTO with artifact or null if not found
   */
  async getArtifactByIdWithArtifact(
    id: string,
    tx?: DrizzleTransaction
  ): Promise<TestArtifactWithArtifactDTO | null> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);

      const [row] = await db.select().from(testArtifacts).where(eq(testArtifacts.id, id));

      return row ? this.toDTOWithArtifact(row) : null;
    });
  }

  /**
   * Create new test artifact
   * Automatically sets processingStatus to 'pending'
   * @throws ValidationError if input validation fails
   * @throws UnauthorizedError if user is not authenticated
   */
  async createArtifact(
    input: CreateTestArtifactInput,
    tx?: DrizzleTransaction,
    context?: import('./types').UserContext
  ): Promise<TestArtifactDTO> {
    return this.executeQuery(async () => {
      // Require authentication for creating artifacts
      this.requireAuth(context);
      // Validate input with detailed error logging
      let validated;
      try {
        validated = createTestArtifactSchema.parse(input);
      } catch (error) {
        // Log validation failure with details for debugging (suppress in tests)
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.error('[TestArtifactsRepository] Validation failed:', {
            framework: input.framework,
            artifactSize: input.artifact ? JSON.stringify(input.artifact).length : 0,
            hasGithubMetadata: !!input.githubRepository,
            error: error instanceof Error ? error.message : 'Unknown validation error',
          });
        }
        throw error; // Re-throw to be transformed by executeQuery
      }

      const db = this.getDb(tx);

      const [created] = await db
        .insert(testArtifacts)
        .values({
          framework: validated.framework,
          artifact: validated.artifact,
          processingStatus: 'pending',
          githubRepository: validated.githubRepository,
          githubSha: validated.githubSha,
          githubHeadRef: validated.githubHeadRef,
          githubBaseRef: validated.githubBaseRef,
          githubRef: validated.githubRef,
          githubActor: validated.githubActor,
          githubRunId: validated.githubRunId,
          githubRunNumber: validated.githubRunNumber,
          githubRunAttempt: validated.githubRunAttempt,
          githubJob: validated.githubJob,
          runnerName: validated.runnerName,
          updatedAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new ValidationError('Failed to create test artifact');
      }

      return this.toDTO(created);
    });
  }

  /**
   * Update processing status with metadata
   * Automatically updates processedAt when status is 'processed'
   * @throws UnauthorizedError if user is not authenticated
   * @throws ForbiddenError if user is not an admin
   */
  async updateProcessingStatus(
    id: string,
    status: 'pending' | 'processing' | 'processed' | 'failed',
    options?: {
      error?: string;
      frameworkVersion?: string;
      durationMs?: number;
    },
    tx?: DrizzleTransaction,
    context?: import('./types').UserContext
  ): Promise<TestArtifactDTO | null> {
    return this.executeQuery(async () => {
      // Require admin role only when called from user context (API routes)
      // Background jobs pass no context and are allowed as system operations
      if (context !== undefined) {
        this.requireAdmin(context);
      }
      // Validate status update
      updateProcessingStatusSchema.parse({
        status,
        error: options?.error,
        frameworkVersion: options?.frameworkVersion,
        durationMs: options?.durationMs,
      });

      const db = this.getDb(tx);

      const updateData: Record<string, unknown> = {
        processingStatus: status,
        updatedAt: new Date(),
      };

      if (options?.error) {
        updateData.processingError = options.error;
      }

      if (options?.frameworkVersion) {
        updateData.frameworkVersion = options.frameworkVersion;
      }

      if (options?.durationMs !== undefined) {
        updateData.processingDurationMs = options.durationMs;
      }

      // Set processedAt when status becomes 'processed'
      if (status === 'processed') {
        updateData.processedAt = new Date();
      }

      const [updated] = await db
        .update(testArtifacts)
        .set(updateData)
        .where(eq(testArtifacts.id, id))
        .returning();

      return updated ? this.toDTO(updated) : null;
    });
  }

  /**
   * Get pending artifacts for background processing
   * Returns artifacts with full payload ordered by createdAt
   */
  async getPendingArtifacts(
    limit: number,
    tx?: DrizzleTransaction
  ): Promise<TestArtifactWithArtifactDTO[]> {
    return this.executeQuery(async () => {
      const db = this.getDb(tx);

      const rows = await db
        .select()
        .from(testArtifacts)
        .where(eq(testArtifacts.processingStatus, 'pending'))
        .orderBy(testArtifacts.createdAt)
        .limit(limit);

      return rows.map((row) => this.toDTOWithArtifact(row));
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const testArtifactsRepository = new TestArtifactsRepository();
