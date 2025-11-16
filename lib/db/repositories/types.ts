import 'server-only';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from '../schema';

/**
 * Drizzle ORM transaction type
 * Allows repositories to participate in atomic multi-step operations
 */
export type DrizzleTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Database or transaction instance
 * Repositories accept either for flexibility
 */
export type DatabaseOrTransaction = typeof import('../index').db | DrizzleTransaction;

/**
 * User context for authorization
 * Passed to repository methods that require access control
 */
export interface UserContext {
  userId: string; // From JWT 'sub' claim
  roles: string[]; // From JWT 'roles' claim
}

/**
 * Pagination parameters
 * Standard structure for all list operations
 */
export interface PaginationParams {
  page: number; // 1-indexed page number
  pageSize: number; // Items per page (max 100)
}

/**
 * Pagination result
 * Standard structure for all paginated responses
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Base repository interface
 * Provides common CRUD operations with transaction support
 */
export interface BaseRepository<TInsert, TSelect, TUpdate> {
  /**
   * Find record by ID
   * @returns Record or null if not found
   */
  findById(id: string | number, tx?: DrizzleTransaction): Promise<TSelect | null>;

  /**
   * Create new record
   * @throws ValidationError if input validation fails
   * @returns Created record
   */
  create(data: TInsert, tx?: DrizzleTransaction): Promise<TSelect>;

  /**
   * Update existing record
   * @returns Updated record or null if not found
   */
  update(id: string | number, data: TUpdate, tx?: DrizzleTransaction): Promise<TSelect | null>;

  /**
   * Delete record by ID
   * @returns true if deleted, false if not found
   */
  delete(id: string | number, tx?: DrizzleTransaction): Promise<boolean>;
}
