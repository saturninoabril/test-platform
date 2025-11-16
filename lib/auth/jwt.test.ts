import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateJwtToken,
  verifyJwtToken,
  hasRole,
  hasAllRoles,
  extractJwtToken,
  validateJwtToken,
  withJwtRole,
  type JwtPayload,
} from './jwt';

// Mock environment variables
beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-for-testing-only-do-not-use-in-production';
  process.env.JWT_ISSUER = 'test-issuer';
});

describe('JWT Authentication', () => {
  describe('generateJwtToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateJwtToken('test-user', ['admin'], '1h');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include subject and roles in token', () => {
      const token = generateJwtToken('test-service', ['read:events', 'write:events'], '1h');
      const decoded = verifyJwtToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.sub).toBe('test-service');
      expect(decoded?.roles).toEqual(['read:events', 'write:events']);
    });

    it('should include issuer in token', () => {
      const token = generateJwtToken('test-user', ['admin'], '1h');
      const decoded = verifyJwtToken(token);

      expect(decoded?.iss).toBe('test-issuer');
    });
  });

  describe('verifyJwtToken', () => {
    it('should verify a valid token', () => {
      const token = generateJwtToken('test-user', ['admin'], '1h');
      const decoded = verifyJwtToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.sub).toBe('test-user');
      expect(decoded?.roles).toContain('admin');
    });

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = verifyJwtToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('should reject a token with wrong secret', () => {
      const token = generateJwtToken('test-user', ['admin'], '1h');

      // Change the secret
      process.env.JWT_SECRET = 'different-secret';

      const decoded = verifyJwtToken(token);
      expect(decoded).toBeNull();
    });

    it('should reject an expired token', () => {
      // Generate token that expires immediately
      const token = generateJwtToken('test-user', ['admin'], -1);

      const decoded = verifyJwtToken(token);
      expect(decoded).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('should return true if user has the required role', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['admin', 'read:events'],
      };

      expect(hasRole(payload, 'admin')).toBe(true);
      expect(hasRole(payload, 'read:events')).toBe(true);
    });

    it('should return false if user does not have the required role', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['read:events'],
      };

      expect(hasRole(payload, 'admin')).toBe(false);
      expect(hasRole(payload, 'write:events')).toBe(false);
    });

    it('should support OR logic with multiple roles', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['read:events'],
      };

      // Has at least one of the required roles
      expect(hasRole(payload, ['admin', 'read:events'])).toBe(true);
      expect(hasRole(payload, ['admin', 'write:events'])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true if user has all required roles', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['admin', 'read:events', 'write:events'],
      };

      expect(hasAllRoles(payload, ['admin', 'read:events'])).toBe(true);
      expect(hasAllRoles(payload, ['read:events', 'write:events'])).toBe(true);
    });

    it('should return false if user is missing any required role', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['read:events'],
      };

      expect(hasAllRoles(payload, ['admin', 'read:events'])).toBe(false);
      expect(hasAllRoles(payload, ['read:events', 'write:events'])).toBe(false);
    });

    it('should return true for empty role list', () => {
      const payload: JwtPayload = {
        sub: 'test-user',
        roles: ['read:events'],
      };

      expect(hasAllRoles(payload, [])).toBe(true);
    });
  });

  describe('Role Hierarchy', () => {
    describe('admin role', () => {
      it('should grant access to all endpoints', () => {
        const payload: JwtPayload = {
          sub: 'admin-user',
          roles: ['admin'],
        };

        // Admin should have access to everything
        expect(hasRole(payload, 'read:events')).toBe(true);
        expect(hasRole(payload, 'write:events')).toBe(true);
        expect(hasRole(payload, 'read:reports')).toBe(true);
        expect(hasRole(payload, 'write:reports')).toBe(true);
        expect(hasRole(payload, 'delete:data')).toBe(true);
        expect(hasRole(payload, 'any:resource')).toBe(true);
      });

      it('should satisfy all role checks', () => {
        const payload: JwtPayload = {
          sub: 'admin-user',
          roles: ['admin'],
        };

        // Admin should satisfy any combination of role requirements
        expect(hasAllRoles(payload, ['read:events', 'write:reports'])).toBe(true);
        expect(hasRole(payload, ['read:events', 'write:reports', 'delete:data'])).toBe(true);
      });
    });

    describe('write role hierarchy', () => {
      it('should grant read access to the same resource', () => {
        const payload: JwtPayload = {
          sub: 'writer-user',
          roles: ['write:reports'],
        };

        // write:reports should imply read:reports
        expect(hasRole(payload, 'read:reports')).toBe(true);
        expect(hasRole(payload, 'write:reports')).toBe(true);
      });

      it('should not grant read access to different resources', () => {
        const payload: JwtPayload = {
          sub: 'writer-user',
          roles: ['write:reports'],
        };

        // write:reports should NOT imply read:events
        expect(hasRole(payload, 'read:events')).toBe(false);
        expect(hasRole(payload, 'write:events')).toBe(false);
      });

      it('should work with multiple write roles', () => {
        const payload: JwtPayload = {
          sub: 'multi-writer',
          roles: ['write:reports', 'write:events'],
        };

        // Should have read access to both resources
        expect(hasRole(payload, 'read:reports')).toBe(true);
        expect(hasRole(payload, 'read:events')).toBe(true);
        expect(hasRole(payload, 'write:reports')).toBe(true);
        expect(hasRole(payload, 'write:events')).toBe(true);
      });
    });

    describe('read role', () => {
      it('should only grant read access to specified resource', () => {
        const payload: JwtPayload = {
          sub: 'reader-user',
          roles: ['read:events'],
        };

        expect(hasRole(payload, 'read:events')).toBe(true);
        expect(hasRole(payload, 'write:events')).toBe(false);
        expect(hasRole(payload, 'read:reports')).toBe(false);
      });
    });

    describe('simplified endpoint protection', () => {
      it('should allow specifying only required role without admin', () => {
        // User with write:reports role
        const writerPayload: JwtPayload = {
          sub: 'writer',
          roles: ['write:reports'],
        };

        // Admin user
        const adminPayload: JwtPayload = {
          sub: 'admin',
          roles: ['admin'],
        };

        // Both should pass with just 'write:reports' requirement
        // No need to specify ['write:reports', 'admin']
        expect(hasRole(writerPayload, 'write:reports')).toBe(true);
        expect(hasRole(adminPayload, 'write:reports')).toBe(true);
      });

      it('should allow read endpoints to accept write roles', () => {
        const writerPayload: JwtPayload = {
          sub: 'writer',
          roles: ['write:events'],
        };

        // write:events should be able to access read:events endpoints
        // No need to specify ['read:events', 'write:events', 'admin']
        expect(hasRole(writerPayload, 'read:events')).toBe(true);
      });
    });
  });

  describe('extractJwtToken', () => {
    it('should extract token from Bearer authorization header', () => {
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: 'Bearer test-token-123',
        },
      });

      const token = extractJwtToken(request);
      expect(token).toBe('test-token-123');
    });

    it('should return plain token if no Bearer prefix', () => {
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: 'plain-token',
        },
      });

      const token = extractJwtToken(request);
      expect(token).toBe('plain-token');
    });

    it('should return null if no authorization header', () => {
      const request = new NextRequest('http://localhost:3001/api/test');

      const token = extractJwtToken(request);
      expect(token).toBeNull();
    });
  });

  describe('validateJwtToken', () => {
    it('should validate and return payload for valid token', () => {
      const token = generateJwtToken('test-user', ['admin'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const payload = validateJwtToken(request);
      expect(payload).toBeTruthy();
      expect(payload?.sub).toBe('test-user');
      expect(payload?.roles).toContain('admin');
    });

    it('should return null for invalid token', () => {
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const payload = validateJwtToken(request);
      expect(payload).toBeNull();
    });

    it('should return null if no token present', () => {
      const request = new NextRequest('http://localhost:3001/api/test');

      const payload = validateJwtToken(request);
      expect(payload).toBeNull();
    });
  });

  describe('withJwtRole middleware', () => {
    it('should call handler when user has required role', async () => {
      const token = generateJwtToken('test-user', ['read:events'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const wrappedHandler = withJwtRole('read:events')(handler);
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return 403 when user lacks required role', async () => {
      const token = generateJwtToken('test-user', ['read:events'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn();
      const wrappedHandler = withJwtRole('write:events')(handler);
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toBe('Forbidden - Insufficient permissions');
    });

    it('should return 401 for invalid token', async () => {
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const handler = vi.fn();
      const wrappedHandler = withJwtRole('admin')(handler);
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should work with array of roles (OR logic)', async () => {
      const token = generateJwtToken('test-user', ['read:reports'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      // User has read:reports, checking for read:events OR read:reports
      const wrappedHandler = withJwtRole(['read:events', 'read:reports'])(handler);
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should work with requireAll flag (AND logic)', async () => {
      const token = generateJwtToken('test-user', ['read:events', 'write:events'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      // User has both roles required
      const wrappedHandler = withJwtRole(['read:events', 'write:events'], true)(handler);
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return 403 with requireAll when missing one role', async () => {
      const token = generateJwtToken('test-user', ['read:events'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn();
      const wrappedHandler = withJwtRole(['read:events', 'write:events'], true)(handler);
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });

    it('should respect role hierarchy with admin role', async () => {
      const token = generateJwtToken('admin-user', ['admin'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      // Admin should have access to write:events endpoint
      const wrappedHandler = withJwtRole('write:events')(handler);
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should respect role hierarchy with write role', async () => {
      const token = generateJwtToken('writer-user', ['write:events'], '1h');
      const request = new NextRequest('http://localhost:3001/api/test', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const handler = vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      // write:events should have access to read:events endpoint
      const wrappedHandler = withJwtRole('read:events')(handler);
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });
});
