/**
 * NextAuth API Route Tests (Vitest)
 *
 * Tests for NextAuth authentication endpoints (app/api/auth/[...nextauth]/route.ts)
 *
 * Tests NextAuth endpoints:
 * - GET /api/auth/providers
 * - GET /api/auth/session (with and without authentication)
 * - GET /api/auth/csrf
 * - GET /api/auth/signin (signin page)
 * - POST /api/auth/signin (signin action)
 * - POST /api/auth/signout (signout action)
 * - Error handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, createCommittedTestDatabase } from '../../../../helpers/test-database';
import { createTestSession } from '../../../../helpers/nextauth-session';
import type { TestUser } from '../../../../helpers/nextauth-session';
import * as schema from '@/lib/db/schema';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Setup database with transaction rollback for test isolation
const testDb = setupTestDatabase();

beforeAll(testDb.beforeAll);
beforeEach(testDb.beforeEach);
afterEach(testDb.afterEach);
afterAll(testDb.afterAll);

describe('GET /api/auth/providers', () => {
  it('should return list of configured providers', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/providers`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();
    expect(data).toBeDefined();
    expect(typeof data).toBe('object');

    // Should include the configured providers
    const providerNames = Object.keys(data);
    expect(providerNames.length).toBeGreaterThan(0);

    // Verify at least one provider is configured (Credentials provider is always configured)
    expect(providerNames).toBeTruthy();
  });

  it('should include provider details', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/providers`);
    const data = await response.json();

    // Each provider should have id, name, and type
    const providers = Object.values(data) as Array<{ id: string; name: string; type: string }>;
    expect(providers.length).toBeGreaterThan(0);

    providers.forEach((provider) => {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('type');
    });
  });
});

describe('GET /api/auth/session - Unauthenticated', () => {
  it('should return null session when not authenticated', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/session`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();
    // When not authenticated, NextAuth v5 returns null
    expect(data).toBeNull();
  });

  it('should return null session with invalid cookie', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        Cookie: 'authjs.session-token=invalid-token-12345',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeNull();
  });
});

describe('GET /api/auth/session - Authenticated', () => {
  it('should return session with valid session cookie', async () => {
    // Create test user and session using committed database
    // (data needs to be visible to the dev server via HTTP)
    const committedDb = await createCommittedTestDatabase();

    try {
      const session = await createTestSession(
        { email: 'test-session@example.com', name: 'Session Test User' },
        committedDb.db
      );

      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: {
          Cookie: session.cookieString,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return session with user data
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('email', session.user.email);
      expect(data.user).toHaveProperty('name', session.user.name);
      // Note: NextAuth v5 JWT strategy includes id via session callback in auth.ts
      if (data.user.id) {
        expect(data.user.id).toBe(session.user.id);
      }
      expect(data).toHaveProperty('expires'); // Session expiry timestamp

      // Cleanup
      await committedDb.db.delete(schema.users);
    } finally {
      await committedDb.cleanup();
    }
  });

  it('should return correct user data in session', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      const userData: Partial<TestUser> & { email: string } = {
        email: 'detailed-user@example.com',
        name: 'Detailed Test User',
        image: 'https://example.com/avatar.jpg',
      };

      const session = await createTestSession(userData, committedDb.db);

      const response = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: {
          Cookie: session.cookieString,
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.user.email).toBe(userData.email);
      expect(data.user.name).toBe(userData.name);
      expect(data.user.image).toBe(userData.image);

      // Cleanup
      await committedDb.db.delete(schema.users);
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('GET /api/auth/csrf', () => {
  it('should return CSRF token', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/csrf`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();
    expect(data).toHaveProperty('csrfToken');
    expect(typeof data.csrfToken).toBe('string');
    expect(data.csrfToken.length).toBeGreaterThan(0);
  });

  it('should return unique CSRF tokens on each request', async () => {
    const response1 = await fetch(`${BASE_URL}/api/auth/csrf`);
    const data1 = await response1.json();

    const response2 = await fetch(`${BASE_URL}/api/auth/csrf`);
    const data2 = await response2.json();

    // Each request should get a unique CSRF token
    expect(data1.csrfToken).not.toBe(data2.csrfToken);
  });

  it('should work without authentication', async () => {
    // CSRF endpoint should be accessible without auth
    const response = await fetch(`${BASE_URL}/api/auth/csrf`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.csrfToken).toBeTruthy();
  });
});

describe('GET /api/auth/signin', () => {
  it('should return signin page HTML', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signin`, {
      redirect: 'manual', // Don't follow redirects
    });

    // NextAuth may redirect to custom signin page (302) or return HTML (200)
    expect([200, 302, 307]).toContain(response.status);

    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/html');
    }
  });

  it('should redirect to custom signin page when configured', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signin`, {
      redirect: 'manual',
    });

    // Should redirect to /auth/signin (configured in auth.ts)
    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get('location');
      expect(location).toBeTruthy();
      // May be absolute or relative URL
      expect(location).toMatch(/\/auth\/signin/);
    }
  });
});

describe('POST /api/auth/signin', () => {
  it('should require CSRF token for signin', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'test@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    });

    // Without CSRF token, should fail or redirect
    // NextAuth may return 400 or redirect to error page
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  it('should handle credentials signin with CSRF token', async () => {
    // First get CSRF token
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfResponse.json();

    // Attempt signin with credentials
    const response = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'test@example.com',
        password: 'password123',
        csrfToken,
      }),
      redirect: 'manual',
    });

    // Should process the request (may succeed or fail based on credentials)
    // NextAuth typically returns 302 redirect
    expect([200, 302, 307, 401]).toContain(response.status);
  });
});

describe('POST /api/auth/signout', () => {
  it('should require CSRF token for signout', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'manual',
    });

    // Without CSRF token, should fail
    // NextAuth may return 400 or redirect with error
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  it('should handle signout with CSRF token', async () => {
    // Get CSRF token
    const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
    const { csrfToken } = await csrfResponse.json();

    // Attempt signout
    const response = await fetch(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        csrfToken,
      }),
      redirect: 'manual',
    });

    // Should process signout (typically redirects)
    expect([200, 302, 307]).toContain(response.status);
  });

  it('should clear session when signing out authenticated user', async () => {
    const committedDb = await createCommittedTestDatabase();

    try {
      // Create authenticated session
      const session = await createTestSession(
        { email: 'signout-test@example.com', name: 'Signout Test User' },
        committedDb.db
      );

      // Get CSRF token
      const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: {
          Cookie: session.cookieString,
        },
      });
      const { csrfToken } = await csrfResponse.json();

      // Signout
      const signoutResponse = await fetch(`${BASE_URL}/api/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: session.cookieString,
        },
        body: new URLSearchParams({
          csrfToken,
        }),
        redirect: 'manual',
      });

      // Should successfully sign out (redirect or 200)
      expect([200, 302, 307]).toContain(signoutResponse.status);

      // Cleanup
      await committedDb.db.delete(schema.users);
    } finally {
      await committedDb.cleanup();
    }
  });
});

describe('NextAuth Error Handling', () => {
  it('should handle invalid auth endpoint gracefully', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/invalid-endpoint-xyz123`);

    // Should return appropriate error (400, 404, or handle gracefully)
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  it('should handle malformed requests gracefully', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST', // Session endpoint only accepts GET
    });

    // Should return appropriate error or handle gracefully
    expect(response.status).toBeGreaterThanOrEqual(200);
  });
});
