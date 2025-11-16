import 'server-only';
import { DatabaseError } from 'pg';
import { ZodError } from 'zod';

/**
 * Base application error
 * All repository errors extend from this
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when authentication is required but missing/invalid
 */
export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * Thrown when resource is not found
 */
export class NotFoundError extends ApplicationError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

/**
 * Thrown when input validation fails
 */
export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Thrown when operation conflicts with existing data
 */
export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * Thrown when authorization check fails
 */
export class ForbiddenError extends ApplicationError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * Transform database errors into application errors
 * Hides database implementation details from clients
 */
export function transformDatabaseError(error: unknown): ApplicationError {
  // If already an application error, return as-is
  if (error instanceof ApplicationError) {
    return error;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const fieldPath = firstIssue?.path.join('.') || 'input';
    const message = firstIssue?.message || 'Validation failed';
    return new ValidationError(`${fieldPath}: ${message}`);
  }

  // PostgreSQL errors from pg driver
  if (error instanceof DatabaseError) {
    const pgError = error;

    // Unique constraint violation (23505)
    if (pgError.code === '23505') {
      return new ConflictError('Resource already exists');
    }

    // Foreign key violation (23503)
    if (pgError.code === '23503') {
      return new ValidationError('Referenced resource does not exist');
    }

    // Not null violation (23502)
    if (pgError.code === '23502') {
      return new ValidationError('Required field is missing');
    }

    // Check constraint violation (23514)
    if (pgError.code === '23514') {
      return new ValidationError('Invalid data format');
    }
  }

  // Generic error fallback - log original error server-side (suppress in tests)
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    console.error('Unexpected database error:', error);
  }

  return new ApplicationError('An unexpected error occurred', 'INTERNAL_ERROR', 500);
}
