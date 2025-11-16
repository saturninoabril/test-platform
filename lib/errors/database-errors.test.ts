// Unit tests for database error transformation

import { describe, it, expect } from 'vitest';
import { DatabaseError } from 'pg';
import {
  ApplicationError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  transformDatabaseError,
} from './database-errors';

describe('Database Error Classes', () => {
  describe('ApplicationError', () => {
    it('should create error with message, code, and status', () => {
      const error = new ApplicationError('Test error', 'TEST_CODE', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ApplicationError');
    });

    it('should default to 500 status code', () => {
      const error = new ApplicationError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(500);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create 401 error with default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('NotFoundError', () => {
    it('should create 404 error with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should accept custom message', () => {
      const error = new NotFoundError('Artifact not found');

      expect(error.message).toBe('Artifact not found');
    });
  });

  describe('ValidationError', () => {
    it('should create 400 error', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ConflictError', () => {
    it('should create 409 error', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('ForbiddenError', () => {
    it('should create 403 error with default message', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });
  });
});

describe('transformDatabaseError', () => {
  it('should return ApplicationError as-is', () => {
    const originalError = new ValidationError('Test error');
    const transformed = transformDatabaseError(originalError);

    expect(transformed).toBe(originalError);
  });

  it('should transform unique constraint violation (23505)', () => {
    const pgError = new DatabaseError('duplicate key', 0, 'error');
    pgError.code = '23505';

    const transformed = transformDatabaseError(pgError);

    expect(transformed).toBeInstanceOf(ConflictError);
    expect(transformed.message).toBe('Resource already exists');
  });

  it('should transform foreign key violation (23503)', () => {
    const pgError = new DatabaseError('foreign key violation', 0, 'error');
    pgError.code = '23503';

    const transformed = transformDatabaseError(pgError);

    expect(transformed).toBeInstanceOf(ValidationError);
    expect(transformed.message).toBe('Referenced resource does not exist');
  });

  it('should transform not null violation (23502)', () => {
    const pgError = new DatabaseError('not null violation', 0, 'error');
    pgError.code = '23502';

    const transformed = transformDatabaseError(pgError);

    expect(transformed).toBeInstanceOf(ValidationError);
    expect(transformed.message).toBe('Required field is missing');
  });

  it('should transform check constraint violation (23514)', () => {
    const pgError = new DatabaseError('check constraint violation', 0, 'error');
    pgError.code = '23514';

    const transformed = transformDatabaseError(pgError);

    expect(transformed).toBeInstanceOf(ValidationError);
    expect(transformed.message).toBe('Invalid data format');
  });

  it('should handle unknown database errors', () => {
    const pgError = new DatabaseError('unknown error', 0, 'error');
    pgError.code = '99999';

    const transformed = transformDatabaseError(pgError);

    expect(transformed).toBeInstanceOf(ApplicationError);
    expect(transformed.message).toBe('An unexpected error occurred');
    expect(transformed.code).toBe('INTERNAL_ERROR');
    expect(transformed.statusCode).toBe(500);
  });

  it('should handle generic JavaScript errors', () => {
    const error = new Error('Something went wrong');

    const transformed = transformDatabaseError(error);

    expect(transformed).toBeInstanceOf(ApplicationError);
    expect(transformed.message).toBe('An unexpected error occurred');
    expect(transformed.code).toBe('INTERNAL_ERROR');
    expect(transformed.statusCode).toBe(500);
  });

  it('should handle non-Error objects', () => {
    const error = { message: 'Some object' };

    const transformed = transformDatabaseError(error);

    expect(transformed).toBeInstanceOf(ApplicationError);
    expect(transformed.statusCode).toBe(500);
  });
});
