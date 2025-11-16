/**
 * Database Transaction Fixture for Playwright Tests
 *
 * Implements BEGIN/ROLLBACK pattern to ensure perfect test isolation:
 * 1. Before each test: BEGIN transaction
 * 2. Run test (all database operations happen within transaction)
 * 3. After test: ROLLBACK (instantly reverts all changes)
 *
 * Benefits:
 * - Instant cleanup (ROLLBACK is instantaneous)
 * - Perfect isolation between parallel tests
 * - Deterministic test outcomes
 * - No manual cleanup code needed
 */

import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../lib/db/schema';

export interface TestDatabase {
  client: PoolClient;
  db: ReturnType<typeof drizzle>;
}

/**
 * Creates a connection pool for test database
 */
export function createTestPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: process.env.DB_NAME || 'change_db',
    ssl: false,
    // Limit pool size for tests to avoid connection exhaustion
    max: 10,
    // Allow tests to acquire connections quickly
    connectionTimeoutMillis: 5000,
    // Close idle connections faster during tests
    idleTimeoutMillis: 10000,
  });
}

/**
 * Begins a database transaction and returns client + Drizzle instance
 *
 * Usage in tests:
 * ```typescript
 * const testDb = await beginTransaction(pool);
 * try {
 *   // Run test operations using testDb.db
 *   await testDb.db.insert(users).values({ ... });
 * } finally {
 *   await rollbackTransaction(testDb);
 * }
 * ```
 */
export async function beginTransaction(pool: Pool): Promise<TestDatabase> {
  const client = await pool.connect();
  await client.query('BEGIN');

  const db = drizzle(client, { schema });

  return { client, db };
}

/**
 * Rolls back the transaction and releases the client
 */
export async function rollbackTransaction(testDb: TestDatabase): Promise<void> {
  try {
    await testDb.client.query('ROLLBACK');
  } finally {
    testDb.client.release();
  }
}

/**
 * Convenience function for running a test within a transaction
 *
 * Automatically handles BEGIN and ROLLBACK, even if test throws an error.
 *
 * Usage:
 * ```typescript
 * await withTransaction(pool, async (db) => {
 *   // Your test code here
 *   await db.insert(users).values({ ... });
 *   // Transaction automatically rolled back after this function
 * });
 * ```
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const testDb = await beginTransaction(pool);
  try {
    return await fn(testDb.db);
  } finally {
    await rollbackTransaction(testDb);
  }
}

/**
 * Closes the database pool (call in global teardown)
 */
export async function closeTestPool(pool: Pool): Promise<void> {
  await pool.end();
}
