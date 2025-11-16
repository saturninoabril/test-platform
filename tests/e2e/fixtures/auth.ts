/**
 * Authentication Fixture for Playwright Tests
 *
 * Provides helper functions for JWT authentication in tests.
 * Uses existing JWT_SECRET from environment to generate valid tokens.
 */

import { sign, decode, type SignOptions } from 'jsonwebtoken';

export interface JWTPayload {
  sub: string; // Subject (user ID or service name)
  roles: string[]; // User roles
  iss?: string; // Issuer
  exp?: number; // Expiration timestamp
  iat?: number; // Issued at timestamp
}

export interface AuthContext {
  token: string;
  headers: {
    Authorization: string;
  };
}

/**
 * Generates a valid JWT token for testing
 *
 * @param payload - JWT payload with subject and roles
 * @param expiresIn - Token expiration (default: 1 hour)
 * @returns Signed JWT token
 */
export function generateTestJWT(
  payload: Omit<JWTPayload, 'iss' | 'iat'>,
  expiresIn = '1h'
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const issuer = process.env.JWT_ISSUER || 'test-platform';

  return sign(
    {
      ...payload,
      iss: issuer,
    },
    secret,
    { expiresIn } as SignOptions
  );
}

/**
 * Creates an authenticated context for API requests
 *
 * @param payload - JWT payload (defaults to test user with admin role)
 * @returns AuthContext with token and Authorization header
 */
export function createAuthContext(payload?: Partial<Omit<JWTPayload, 'iss' | 'iat'>>): AuthContext {
  const defaultPayload: Omit<JWTPayload, 'iss' | 'iat'> = {
    sub: 'test-user',
    roles: ['admin', 'write:reports', 'read:events'],
    ...payload,
  };

  const token = generateTestJWT(defaultPayload);

  return {
    token,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * Creates an expired JWT token for testing authentication failures
 *
 * @param payload - JWT payload
 * @returns Expired JWT token
 */
export function generateExpiredTestJWT(payload: Omit<JWTPayload, 'iss' | 'iat' | 'exp'>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const issuer = process.env.JWT_ISSUER || 'test-platform';

  // Create token that expired 1 hour ago
  const expiredTime = Math.floor(Date.now() / 1000) - 3600;

  return sign(
    {
      ...payload,
      iss: issuer,
      exp: expiredTime,
    },
    secret
  );
}

/**
 * Creates an invalid JWT token (wrong signature) for testing
 *
 * @param payload - JWT payload
 * @returns Invalid JWT token
 */
export function generateInvalidTestJWT(payload: Omit<JWTPayload, 'iss' | 'iat'>): string {
  const issuer = process.env.JWT_ISSUER || 'test-platform';

  // Sign with wrong secret
  return sign(
    {
      ...payload,
      iss: issuer,
    },
    'wrong-secret-key',
    { expiresIn: '1h' } as SignOptions
  );
}

/**
 * Predefined test users for common scenarios
 */
export const TestUsers = {
  /** Admin user with all permissions */
  admin: (): AuthContext =>
    createAuthContext({
      sub: 'admin-user',
      roles: ['admin', 'write:reports', 'read:events'],
    }),

  /** Regular user with limited permissions */
  regular: (): AuthContext =>
    createAuthContext({
      sub: 'regular-user',
      roles: ['write:reports'],
    }),

  /** Read-only user */
  readOnly: (): AuthContext =>
    createAuthContext({
      sub: 'readonly-user',
      roles: ['read:events'],
    }),

  /** CI service account */
  ciService: (): AuthContext =>
    createAuthContext({
      sub: 'ci-service',
      roles: ['write:reports', 'admin'],
    }),
};

/**
 * Decodes a JWT token without verification (for test assertions)
 */
export function decodeTestJWT(token: string): JWTPayload {
  return decode(token) as JWTPayload;
}
