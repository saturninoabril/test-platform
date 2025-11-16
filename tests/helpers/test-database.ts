/**
 * Test Database Helper
 *
 * Utilities for test database isolation using per-test-type databases.
 * Each test type (api, pages, e2e) uses a dedicated database (e.g., test_api_db).
 * Individual tests use transaction-based isolation with rollback.
 */

import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/lib/db/schema';

export interface TestDatabase {
  pool: Pool;
  client: PoolClient;
  db: NodePgDatabase<typeof schema>;
}

export interface CommittedTestDb {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  cleanup: () => Promise<void>;
}

/**
 * Setup test database with transaction-based isolation
 * Connects to the pre-created test database for the current test type
 * Returns functions to be called in beforeAll, beforeEach, afterEach, afterAll
 */
export function setupTestDatabase() {
  const state: {
    pool?: Pool;
    client?: PoolClient;
    db?: NodePgDatabase<typeof schema>;
  } = {};

  return {
    async beforeAll(): Promise<void> {
      // Connect to the test database (already created by test setup script)
      state.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5433,
        user: process.env.DB_USER || 'change_user',
        password: process.env.DB_PASSWORD || 'change_password',
        database: process.env.DB_NAME || 'change_db',
        ssl: false,
      });
    },

    async beforeEach(): Promise<TestDatabase> {
      if (!state.pool) throw new Error('Pool not initialized - call beforeAll first');
      // Begin transaction for test isolation
      state.client = await state.pool.connect();
      await state.client.query('BEGIN');
      state.db = drizzle(state.client, { schema });
      return { pool: state.pool, client: state.client, db: state.db };
    },

    async afterEach(): Promise<void> {
      if (!state.client) return;
      // Rollback transaction and release client
      await state.client.query('ROLLBACK');
      state.client.release();
    },

    async afterAll(): Promise<void> {
      // Close connection pool
      if (state.pool) {
        await state.pool.end();
      }
    },
  };
}

/**
 * Create a separate database connection for tests that need committed data
 * Use this when tests need to insert data that will be read by the dev server via HTTP
 *
 * Example: Tests that insert data and then make HTTP requests to fetch it
 */
export async function createCommittedTestDatabase(): Promise<CommittedTestDb> {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: process.env.DB_NAME || 'change_db',
    ssl: false,
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    cleanup: async () => {
      await pool.end();
    },
  };
}
