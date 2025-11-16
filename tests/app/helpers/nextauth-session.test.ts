/**
 * NextAuth Session Helper Tests
 *
 * Verifies that the session helper creates valid tokens and cookies
 * that work with NextAuth's auth() function.
 *
 * Note: NextAuth v5 uses encrypted JWTs (JWE), not plain JWTs,
 * so we test integration with the actual endpoint rather than decoding.
 *
 * Database Isolation: Uses per-file test database with transaction rollback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestSession,
  generateNextAuthToken,
  createSessionCookie,
} from '../../helpers/nextauth-session';
import { setupTestDatabase } from '../../helpers/test-database';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Setup test database with transaction-based isolation
const testDb = setupTestDatabase();

beforeAll(testDb.beforeAll);
afterAll(testDb.afterAll);

describe('NextAuth Session Helper', () => {
  describe('createTestSession', () => {
    it('should create a test session with user and cookie', async () => {
      const { db } = await testDb.beforeEach();
      try {
        const session = await createTestSession(
          {
            email: 'session-test@example.com',
            name: 'Session Test User',
          },
          db
        );

        expect(session).toHaveProperty('cookieString');
        expect(session).toHaveProperty('user');
        expect(session.user).toHaveProperty('id');
        expect(session.user).toHaveProperty('email', 'session-test@example.com');
        expect(session.user).toHaveProperty('name', 'Session Test User');
        expect(session.cookieString).toContain('authjs.session-token=');
      } finally {
        await testDb.afterEach();
      }
    });

    it('should generate unique email if not provided', async () => {
      const { db } = await testDb.beforeEach();
      try {
        const session1 = await createTestSession(undefined, db);
        const session2 = await createTestSession(undefined, db);

        expect(session1.user.email).not.toBe(session2.user.email);
        expect(session1.user.email).toMatch(/@example\.com$/);
      } finally {
        await testDb.afterEach();
      }
    });
  });

  describe('generateNextAuthToken', () => {
    it('should generate a valid encrypted token (JWE)', async () => {
      const user = {
        id: crypto.randomUUID(),
        email: 'token-test@example.com',
        name: 'Token Test',
      };

      const token = await generateNextAuthToken(user);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // NextAuth v5 tokens are encrypted JWEs, not plain JWTs
      // They have 5 parts (header.encrypted_key.iv.ciphertext.tag) instead of 3
      expect(token.split('.')).toHaveLength(5); // JWE has 5 parts
    });
  });

  describe('createSessionCookie', () => {
    it('should format cookie string correctly', () => {
      const token = 'test.jwt.token';
      const cookie = createSessionCookie(token);

      expect(cookie).toContain('authjs.session-token=');
      expect(cookie).toContain(token);
    });
  });

  describe('Integration with /api/protected', () => {
    it('should authenticate with created session', async () => {
      const { db } = await testDb.beforeEach();
      try {
        const session = await createTestSession(
          {
            email: 'protected-test@example.com',
            name: 'Protected Test User',
          },
          db
        );

        const response = await fetch(`${BASE_URL}/api/protected`, {
          headers: {
            Cookie: session.cookieString,
          },
        });

        // Should successfully authenticate with the session
        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('user');
        expect(data.user.email).toBe('protected-test@example.com');
      } finally {
        await testDb.afterEach();
      }
    });
  });
});
