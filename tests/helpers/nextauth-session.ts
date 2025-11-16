/**
 * NextAuth Session Helper for Tests
 *
 * Utilities for creating authenticated test sessions with NextAuth v5.
 * Generates valid JWT tokens and session cookies that work with NextAuth's auth() function.
 *
 * NextAuth v5 uses encrypted JWTs (JWE) with a salt based on the cookie name.
 * We use the `encode` function from @auth/core/jwt to create compatible tokens.
 */

import { encode } from '@auth/core/jwt';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  emailVerified?: Date | null;
  image?: string | null;
}

export interface SessionCookie {
  cookieString: string;
  user: TestUser;
}

/**
 * Create a test user in the database
 * @param userData User data to create
 * @param dbInstance Optional database instance (for transaction support)
 * @returns Created user
 */
export async function createTestUser(
  userData: Partial<TestUser> & { email: string },
  dbInstance?: NodePgDatabase<typeof schema>
): Promise<TestUser> {
  const dbToUse = dbInstance || db;

  const user: TestUser = {
    id: crypto.randomUUID(),
    email: userData.email,
    name: userData.name || 'Test User',
    emailVerified: userData.emailVerified || null,
    image: userData.image || null,
  };

  await dbToUse.insert(schema.users).values(user).execute();

  return user;
}

/**
 * Get the cookie name based on environment
 * NextAuth v5 uses different cookie names in development vs production
 * @returns Cookie name to use as salt for JWT encryption
 */
function getCookieName(): string {
  // NextAuth v5 cookie name format:
  // - Development: authjs.session-token
  // - Production: __Secure-authjs.session-token or __Host-authjs.session-token
  return process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';
}

/**
 * Generate a NextAuth JWT token using NextAuth's encode function
 * NextAuth v5 uses encrypted JWTs (JWE) with a salt based on the cookie name
 * @param user User data to encode in token
 * @returns Encrypted JWT token compatible with NextAuth v5
 */
export async function generateNextAuthToken(user: TestUser): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET not set in environment');
  }

  const cookieName = getCookieName();

  // Use NextAuth's encode function to create an encrypted JWT (JWE)
  // The salt is critical - it must match the cookie name
  const token = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
      // NextAuth v5 adds these to the JWT
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    },
    secret,
    salt: cookieName, // Critical: salt must be the cookie name
    maxAge: 60 * 60, // 1 hour in seconds
  });

  return token;
}

/**
 * Create a session cookie string for fetch requests
 * @param token JWT token
 * @returns Cookie string formatted for HTTP headers
 */
export function createSessionCookie(token: string): string {
  const cookieName = getCookieName();

  // Format: name=value; additional attributes are set by NextAuth
  return `${cookieName}=${token}`;
}

/**
 * Create a complete test session with user and cookie
 * This is the main helper function for tests
 * @param userData Optional user data to customize
 * @param dbInstance Optional database instance for transaction support
 * @returns Session cookie and user data
 */
export async function createTestSession(
  userData?: Partial<TestUser> & { email?: string },
  dbInstance?: NodePgDatabase<typeof schema>
): Promise<SessionCookie> {
  // Create user in database
  const user = await createTestUser(
    {
      email: userData?.email || `test-${Date.now()}@example.com`,
      name: userData?.name || 'Test User',
      emailVerified: userData?.emailVerified,
      image: userData?.image,
    },
    dbInstance
  );

  // Generate JWT token
  const token = await generateNextAuthToken(user);

  // Create cookie string
  const cookieString = createSessionCookie(token);

  return {
    cookieString,
    user,
  };
}

/**
 * Delete a test user from the database
 * @param userId User ID to delete
 * @param dbInstance Optional database instance for transaction support
 */
export async function cleanupTestUser(
  userId: string,
  dbInstance?: NodePgDatabase<typeof schema>
): Promise<void> {
  const dbToUse = dbInstance || db;

  await dbToUse.delete(schema.users).where(eq(schema.users.id, userId)).execute();
}

/**
 * Setup helper for test suites that need authenticated sessions
 * Returns functions to use in beforeAll, afterAll hooks
 *
 * @example
 * const sessionHelper = setupTestSession();
 *
 * beforeAll(async () => {
 *   const session = await sessionHelper.createSession();
 *   // Use session.cookieString in requests
 * });
 *
 * afterAll(async () => {
 *   await sessionHelper.cleanup();
 * });
 */
export function setupTestSession() {
  const state: {
    sessions: SessionCookie[];
  } = {
    sessions: [],
  };

  return {
    /**
     * Create a new test session
     */
    async createSession(userData?: Partial<TestUser> & { email?: string }): Promise<SessionCookie> {
      const session = await createTestSession(userData);
      state.sessions.push(session);
      return session;
    },

    /**
     * Clean up all created sessions
     */
    async cleanup(): Promise<void> {
      for (const session of state.sessions) {
        await cleanupTestUser(session.user.id);
      }
      state.sessions = [];
    },

    /**
     * Get all created sessions
     */
    getSessions(): SessionCookie[] {
      return state.sessions;
    },
  };
}
