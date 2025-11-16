import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface JwtPayload {
  sub: string; // Subject (user/service ID)
  roles: string[]; // Roles and permissions
  iat?: number; // Issued at
  exp?: number; // Expiration
  iss?: string; // Issuer
}

interface TokenPayload {
  sub: string;
  roles: string[];
  iss: string;
}

// Get JWT secret from environment
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate a JWT token with expiration and roles
 * @param subject - User or service identifier
 * @param roles - Array of roles/permissions (e.g., ['admin', 'read:events', 'write:events'])
 * @param expiresIn - Token expiration time (default: '1h')
 * @returns Signed JWT token
 */
export function generateJwtToken(
  subject: string,
  roles: string[],
  expiresIn: string | number = '1h'
): string {
  const secret = getJwtSecret();
  const issuer = process.env.JWT_ISSUER || 'test-platform';

  const payload: TokenPayload = {
    sub: subject,
    roles,
    iss: issuer,
  };

  return jwt.sign(payload, secret, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expiresIn: expiresIn as any,
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    // Suppress console logs in tests to avoid noise
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.error('JWT verification failed:', error.message);
      } else if (error instanceof jwt.TokenExpiredError) {
        console.error('JWT token expired:', error.message);
      } else {
        console.error('JWT verification error:', error);
      }
    }
    return null;
  }
}

/**
 * Extract JWT token from Authorization header
 * @param request - NextRequest object
 * @returns JWT token or null if not found
 */
export function extractJwtToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Also support plain token
  return authHeader;
}

/**
 * Validate JWT token from request headers
 * @param request - NextRequest object
 * @returns Decoded payload or null if invalid
 */
export function validateJwtToken(request: NextRequest): JwtPayload | null {
  const token = extractJwtToken(request);

  if (!token) {
    return null;
  }

  return verifyJwtToken(token);
}

/**
 * Check if user roles satisfy the required role with hierarchy
 * @param userRoles - Array of roles the user has
 * @param requiredRole - The role being checked
 * @returns true if user has the required role or a higher role
 */
function satisfiesRole(userRoles: string[], requiredRole: string): boolean {
  // Check if user has admin (grants everything)
  if (userRoles.includes('admin')) {
    return true;
  }

  // Check if user has the exact role
  if (userRoles.includes(requiredRole)) {
    return true;
  }

  // If required role is read:*, check if user has write:* for the same resource
  if (requiredRole.startsWith('read:')) {
    const resource = requiredRole.substring(5); // Remove 'read:' prefix
    if (userRoles.includes(`write:${resource}`)) {
      return true; // write implies read
    }
  }

  return false;
}

/**
 * Check if a JWT payload has the required role(s)
 * @param payload - JWT payload
 * @param requiredRoles - Single role or array of roles (OR logic - user needs at least one)
 * @returns true if authorized, false otherwise
 */
export function hasRole(payload: JwtPayload, requiredRoles: string | string[]): boolean {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.some((requiredRole) => satisfiesRole(payload.roles, requiredRole));
}

/**
 * Check if a JWT payload has ALL required roles
 * @param payload - JWT payload
 * @param requiredRoles - Array of roles (AND logic - user needs all)
 * @returns true if authorized, false otherwise
 */
export function hasAllRoles(payload: JwtPayload, requiredRoles: string[]): boolean {
  return requiredRoles.every((requiredRole) => satisfiesRole(payload.roles, requiredRole));
}

/**
 * Middleware wrapper for JWT authentication with role validation
 * @param requiredRoles - Single role or array of roles required to access the endpoint
 * @param requireAll - If true, requires ALL roles; if false, requires ANY role (default: false)
 * @returns Middleware wrapper function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withJwtRole<T = any>(
  requiredRoles: string | string[],
  requireAll: boolean = false
) {
  return (
    handler: (request: NextRequest, context?: T, payload?: JwtPayload) => Promise<Response>
  ) => {
    return async (request: NextRequest, context?: T): Promise<Response> => {
      const payload = validateJwtToken(request);

      if (!payload) {
        return NextResponse.json(
          { error: 'Unauthorized - Invalid or missing JWT token' },
          { status: 401 }
        );
      }

      // Check role authorization
      const authorized = requireAll
        ? hasAllRoles(payload, Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles])
        : hasRole(payload, requiredRoles);

      if (!authorized) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        );
      }

      return handler(request, context, payload);
    };
  };
}

/**
 * Generate a secure random secret for JWT signing
 * This should be run once and stored in environment variables
 */
export function generateJwtSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}
