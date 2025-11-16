import 'server-only';
import { z } from 'zod';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';
import { apiEvents } from '../schema';
import { BaseRepository } from './base.repository';
import type { DrizzleTransaction, PaginatedResult } from './types';
import { ValidationError } from '../../errors/database-errors';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for creating API events
 * Validates all input before database insertion
 */
const createApiEventSchema = z.object({
  method: z.string(),
  endpoint: z.string(),
  statusCode: z.number().int(),
  requestTimestamp: z.date(),
  responseTimestamp: z.date(),
  durationMs: z.number().int().nonnegative(),
  authenticationStatus: z.string(),
  maskedJWTToken: z.string().optional(),
  jwtSubject: z.string().optional(),
  jwtRoles: z.string().optional(),
  sourceIdentifier: z.string().optional(),
  errorType: z.string().optional(),
  errorMessage: z.string().optional(),
  requestPayload: z.unknown().optional(),
  responsePayload: z.unknown().optional(),
  requestPayloadSize: z.number().int().nonnegative().optional(),
  responsePayloadSize: z.number().int().nonnegative().optional(),
  payloadTruncated: z.string().optional(),
  context: z.unknown().optional(),
});

/**
 * Schema for listing API events with filters
 */
const listApiEventsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  endpoint: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.number().int().optional(),
  authenticationStatus: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  sortBy: z.enum(['createdAt', 'durationMs', 'statusCode']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

export type CreateApiEventInput = z.infer<typeof createApiEventSchema>;
export type ListApiEventsInput = z.infer<typeof listApiEventsSchema>;

// ============================================================================
// Data Transfer Objects (DTOs)
// ============================================================================

/**
 * API event DTO
 * All fields are exposed since sensitive data is already masked during creation
 */
export interface ApiEventDTO {
  id: string;
  method: string;
  endpoint: string;
  statusCode: number;
  requestTimestamp: Date;
  responseTimestamp: Date;
  durationMs: number;
  authenticationStatus: string;
  maskedJWTToken: string | null;
  jwtSubject: string | null;
  jwtRoles: string | null;
  sourceIdentifier: string | null;
  errorType: string | null;
  errorMessage: string | null;
  requestPayload: unknown | null;
  responsePayload: unknown | null;
  requestPayloadSize: number | null;
  responsePayloadSize: number | null;
  payloadTruncated: string | null;
  context: unknown | null;
  createdAt: Date;
}

// ============================================================================
// Repository Class
// ============================================================================

class ApiEventsRepository extends BaseRepository {
  /**
   * Transform database row to DTO
   */
  private toDTO(row: typeof apiEvents.$inferSelect): ApiEventDTO {
    return {
      id: row.id,
      method: row.method,
      endpoint: row.endpoint,
      statusCode: row.statusCode,
      requestTimestamp: row.requestTimestamp,
      responseTimestamp: row.responseTimestamp,
      durationMs: row.durationMs,
      authenticationStatus: row.authenticationStatus,
      maskedJWTToken: row.maskedJWTToken,
      jwtSubject: row.jwtSubject,
      jwtRoles: row.jwtRoles,
      sourceIdentifier: row.sourceIdentifier,
      errorType: row.errorType,
      errorMessage: row.errorMessage,
      requestPayload: row.requestPayload,
      responsePayload: row.responsePayload,
      requestPayloadSize: row.requestPayloadSize,
      responsePayloadSize: row.responsePayloadSize,
      payloadTruncated: row.payloadTruncated,
      context: row.context,
      createdAt: row.createdAt,
    };
  }

  /**
   * List events with pagination and filtering
   * @throws UnauthorizedError if user is not authenticated
   * @throws ForbiddenError if user is not an admin
   */
  async listEvents(
    params: ListApiEventsInput,
    tx?: DrizzleTransaction,
    context?: import('./types').UserContext
  ): Promise<PaginatedResult<ApiEventDTO>> {
    return this.executeQuery(async () => {
      // Require admin role for viewing events
      this.requireAdmin(context);
      // Validate input
      const validated = listApiEventsSchema.parse(params);
      const {
        page,
        pageSize,
        endpoint,
        method,
        statusCode,
        authenticationStatus,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      } = validated;

      const db = this.getDb(tx);

      // Build where conditions
      const conditions = [];
      if (endpoint) {
        conditions.push(eq(apiEvents.endpoint, endpoint));
      }
      if (method) {
        conditions.push(eq(apiEvents.method, method));
      }
      if (statusCode) {
        conditions.push(eq(apiEvents.statusCode, statusCode));
      }
      if (authenticationStatus) {
        conditions.push(eq(apiEvents.authenticationStatus, authenticationStatus));
      }
      if (startDate) {
        conditions.push(gte(apiEvents.createdAt, startDate));
      }
      if (endDate) {
        conditions.push(lte(apiEvents.createdAt, endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiEvents)
        .where(whereClause);

      const totalCount = countResult?.count || 0;

      // Determine sort column and order
      const offset = this.calculateOffset(page, pageSize);
      let orderFn;

      if (sortBy === 'durationMs') {
        orderFn = sortOrder === 'asc' ? asc(apiEvents.durationMs) : desc(apiEvents.durationMs);
      } else if (sortBy === 'statusCode') {
        orderFn = sortOrder === 'asc' ? asc(apiEvents.statusCode) : desc(apiEvents.statusCode);
      } else {
        orderFn = sortOrder === 'asc' ? asc(apiEvents.createdAt) : desc(apiEvents.createdAt);
      }

      const rows = await db
        .select()
        .from(apiEvents)
        .where(whereClause)
        .orderBy(orderFn)
        .limit(pageSize)
        .offset(offset);

      return {
        data: rows.map((row) => this.toDTO(row)),
        pagination: this.buildPagination({ page, pageSize, totalCount }),
      };
    });
  }

  /**
   * Get single event by ID
   * @throws UnauthorizedError if user is not authenticated
   * @throws ForbiddenError if user is not an admin
   */
  async getEventById(
    id: string,
    tx?: DrizzleTransaction,
    context?: import('./types').UserContext
  ): Promise<ApiEventDTO | null> {
    return this.executeQuery(async () => {
      // Require admin role for viewing events
      this.requireAdmin(context);
      const db = this.getDb(tx);

      const [row] = await db.select().from(apiEvents).where(eq(apiEvents.id, id));

      return row ? this.toDTO(row) : null;
    });
  }

  /**
   * Create API event
   * Called by logging middleware
   * @throws ValidationError if input validation fails
   */
  async createEvent(data: CreateApiEventInput, tx?: DrizzleTransaction): Promise<ApiEventDTO> {
    return this.executeQuery(async () => {
      // Validate input
      const validated = createApiEventSchema.parse(data);

      const db = this.getDb(tx);

      const [created] = await db
        .insert(apiEvents)
        .values({
          method: validated.method,
          endpoint: validated.endpoint,
          statusCode: validated.statusCode,
          requestTimestamp: validated.requestTimestamp,
          responseTimestamp: validated.responseTimestamp,
          durationMs: validated.durationMs,
          authenticationStatus: validated.authenticationStatus,
          maskedJWTToken: validated.maskedJWTToken,
          jwtSubject: validated.jwtSubject,
          jwtRoles: validated.jwtRoles,
          sourceIdentifier: validated.sourceIdentifier,
          errorType: validated.errorType,
          errorMessage: validated.errorMessage,
          requestPayload: validated.requestPayload,
          responsePayload: validated.responsePayload,
          requestPayloadSize: validated.requestPayloadSize,
          responsePayloadSize: validated.responsePayloadSize,
          payloadTruncated: validated.payloadTruncated,
          context: validated.context,
        })
        .returning();

      if (!created) {
        throw new ValidationError('Failed to create API event');
      }

      return this.toDTO(created);
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiEventsRepository = new ApiEventsRepository();
