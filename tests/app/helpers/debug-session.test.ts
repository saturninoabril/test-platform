/**
 * Debug session token format
 *
 * Note: NextAuth v5 uses encrypted JWTs (JWE), so we can't simply decode them
 * without using NextAuth's decode function. This test validates integration instead.
 *
 * Database Isolation: Uses per-file test database with transaction rollback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSession } from '../../helpers/nextauth-session';
import { decode } from '@auth/core/jwt';
import { setupTestDatabase } from '../../helpers/test-database';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Setup test database with transaction-based isolation
const testDb = setupTestDatabase();

beforeAll(testDb.beforeAll);
afterAll(testDb.afterAll);

describe('Debug Session Token', () => {
  it('should show token structure and validate with endpoint', async () => {
    const { db } = await testDb.beforeEach();
    try {
      const session = await createTestSession(
        {
          email: 'debug@example.com',
          name: 'Debug User',
        },
        db
      );

      console.log('\n=== Session Debug Info ===');
      console.log('User ID:', session.user.id);
      console.log('Email:', session.user.email);
      console.log('Cookie String:', session.cookieString.substring(0, 100) + '...');

      const token = session.cookieString.split('=')[1];
      console.log('\nToken length:', token.length);
      console.log('Token parts (JWE):', token.split('.').length, '(should be 5 for JWE)');

      // Decode the encrypted JWT using NextAuth's decode function
      const cookieName =
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token';

      const decoded = await decode({
        token,
        secret: process.env.AUTH_SECRET!,
        salt: cookieName,
      });
      console.log('\nDecoded Token Payload:', JSON.stringify(decoded, null, 2));

      // Try the actual endpoint
      console.log('\n=== Testing /api/protected ===');
      const response = await fetch(`${BASE_URL}/api/protected`, {
        headers: {
          Cookie: session.cookieString,
        },
      });

      console.log('Status:', response.status);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));

      // Verify it worked
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe('debug@example.com');
    } finally {
      await testDb.afterEach();
    }
  });
});
