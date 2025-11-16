import 'server-only';
import type { DatabaseOrTransaction, DrizzleTransaction, UserContext } from './types';
import {
  transformDatabaseError,
  UnauthorizedError,
  ForbiddenError,
} from '../../errors/database-errors';
import { db as dbInstance } from '../index';

/**
 * Abstract base repository class
 * Provides common error handling and transaction support
 *
 * All concrete repositories should extend this class
 */
export abstract class BaseRepository {
  /**
   * Get database or transaction instance
   * Allows methods to work within transactions or standalone
   */
  protected getDb(tx?: DrizzleTransaction): DatabaseOrTransaction {
    if (tx) {
      return tx;
    }
    return dbInstance;
  }

  /**
   * Execute database operation with error handling
   * Transforms database errors into application errors
   */
  protected async executeQuery<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw transformDatabaseError(error);
    }
  }

  /**
   * Build pagination metadata
   * Helper for constructing paginated responses
   */
  protected buildPagination(params: { page: number; pageSize: number; totalCount: number }) {
    const { page, pageSize, totalCount } = params;
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      page,
      pageSize,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Calculate offset for pagination
   * Helper for SQL LIMIT/OFFSET queries
   */
  protected calculateOffset(page: number, pageSize: number): number {
    return (page - 1) * pageSize;
  }

  /**
   * Require authentication
   * Throws UnauthorizedError if user context is missing or invalid
   */
  protected requireAuth(context?: UserContext): asserts context is UserContext {
    if (!context || !context.userId) {
      throw new UnauthorizedError('Authentication required');
    }
  }

  /**
   * Require admin role
   * Throws ForbiddenError if user is not an admin
   */
  protected requireAdmin(context?: UserContext): asserts context is UserContext {
    this.requireAuth(context);
    if (!context.roles.includes('admin')) {
      throw new ForbiddenError('Admin access required');
    }
  }

  /**
   * Log authorization failure
   * Helper for security monitoring
   */
  protected logAuthorizationFailure(
    operation: string,
    context: UserContext | undefined,
    reason: string
  ): void {
    // Suppress console logs in tests to avoid noise
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.warn('[Authorization Failure]', {
        operation,
        userId: context?.userId || 'anonymous',
        roles: context?.roles || [],
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
