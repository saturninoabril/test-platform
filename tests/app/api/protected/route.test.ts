/**
 * Protected API Endpoint Tests (Vitest)
 *
 * Tests for the protected API endpoint (app/api/protected/route.ts)
 *
 * Tests NextAuth session-based authentication for both GET and POST methods.
 * Both endpoints require valid NextAuth session cookies.
 *
 * Database Isolation: Uses per-file test database with transaction rollback for each test.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createTestSession, type SessionCookie } from '../../../helpers/nextauth-session';
import { setupTestDatabase } from '../../../helpers/test-database';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Setup test database with transaction-based isolation
const testDb = setupTestDatabase();

let testSession: SessionCookie | null = null;

beforeAll(testDb.beforeAll);
beforeEach(async () => {
  const { db } = await testDb.beforeEach();
  // Create a test session for authenticated tests using isolated database
  testSession = await createTestSession(
    {
      email: 'protected-route-test@example.com',
      name: 'Protected Route Test User',
    },
    db
  );
});
afterEach(testDb.afterEach);
afterAll(testDb.afterAll);

describe('GET /api/protected', () => {
  describe('Unauthenticated Access', () => {
    it('should return 401 without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`);

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should return error message in response body', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`);
      const data = await response.json();

      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 with invalid session cookie', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        headers: {
          Cookie: 'next-auth.session-token=invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authenticated Access', () => {
    it('should return 401 when session cookie is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`);
      expect(response.status).toBe(401);
    });

    it('should return 200 with valid session', async () => {
      if (!testSession) throw new Error('Test session not initialized');

      const response = await fetch(`${BASE_URL}/api/protected`, {
        headers: { Cookie: testSession.cookieString },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('message', 'This is protected data');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('name', 'Protected Route Test User');
      expect(data.user).toHaveProperty('email', 'protected-route-test@example.com');
      expect(data).toHaveProperty('timestamp');
    });

    it('should return user data from session', async () => {
      if (!testSession) throw new Error('Test session not initialized');

      const response = await fetch(`${BASE_URL}/api/protected`, {
        headers: { Cookie: testSession.cookieString },
      });

      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testSession.user.email);
    });
  });
});

describe('POST /api/protected', () => {
  describe('Unauthenticated Access', () => {
    it('should return 401 without authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should return error message in response body', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      });
      const data = await response.json();

      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 even with valid JSON payload', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          data: { foo: 'bar' },
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid session cookie', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'next-auth.session-token=invalid-token',
        },
        body: JSON.stringify({ test: 'data' }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authenticated Access', () => {
    it('should return 401 when session cookie is missing', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      });
      expect(response.status).toBe(401);
    });

    it('should return 200 with valid session and process data', async () => {
      if (!testSession) throw new Error('Test session not initialized');

      const testData = { name: 'Test', value: 123 };
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSession.cookieString,
        },
        body: JSON.stringify(testData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('message', 'Data received successfully');
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('data');
      expect(data.data).toEqual(testData);
    });

    it('should echo back posted data', async () => {
      if (!testSession) throw new Error('Test session not initialized');

      const postData = { foo: 'bar', num: 42, nested: { key: 'value' } };
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSession.cookieString,
        },
        body: JSON.stringify(postData),
      });

      const data = await response.json();
      expect(data.data).toEqual(postData);
    });

    it('should include user email in response', async () => {
      if (!testSession) throw new Error('Test session not initialized');

      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: testSession.cookieString,
        },
        body: JSON.stringify({ test: 'data' }),
      });

      const data = await response.json();
      expect(data.user).toBe(testSession.user.email);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle missing Content-Type header', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      // Should return 401 (auth check happens before JSON parsing)
      expect(response.status).toBe(401);
    });

    it('should handle empty request body', async () => {
      const response = await fetch(`${BASE_URL}/api/protected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 401 (auth check happens before JSON parsing)
      expect(response.status).toBe(401);
    });
  });
});
