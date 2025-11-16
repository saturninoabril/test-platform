#!/usr/bin/env tsx
/**
 * Test Database Setup Script
 *
 * Creates and migrates a database for a specific test type (api, pages, or e2e)
 * Usage: tsx scripts/test-db-setup.ts [api|pages|e2e]
 */

import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Get test type from command line argument
const testType = process.argv[2];

if (!testType || !['api', 'pages', 'e2e'].includes(testType)) {
  console.error('Usage: tsx scripts/test-db-setup.ts [api|pages|e2e]');
  process.exit(1);
}

// Load environment variables from test-type-specific env file
const envPath = path.resolve(process.cwd(), `.env.test.${testType}`);
dotenv.config({ path: envPath });

// Database name for this test type
const databaseName = `test_${testType}_db`;

async function setupTestDatabase() {
  console.log(`Setting up test database for ${testType} tests: ${databaseName}`);

  // Connect to postgres database to create test database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: 'postgres', // Connect to default postgres db
    ssl: false,
  });

  try {
    // Check if database exists
    const checkResult = await adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      databaseName,
    ]);

    if (checkResult.rows.length > 0) {
      console.log(`Database ${databaseName} already exists, dropping it...`);

      // Terminate all connections
      await adminPool.query(
        `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid()
      `,
        [databaseName]
      );

      // Drop existing database
      await adminPool.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    }

    // Create fresh database
    console.log(`Creating database ${databaseName}...`);
    await adminPool.query(`CREATE DATABASE ${databaseName}`);
    console.log(`Database ${databaseName} created successfully`);
  } finally {
    await adminPool.end();
  }

  // Run migrations on the test database
  const dbUrl = `postgresql://${process.env.DB_USER || 'change_user'}:${process.env.DB_PASSWORD || 'change_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5433}/${databaseName}`;

  console.log(`Running migrations on ${databaseName}...`);
  try {
    execSync(`DATABASE_URL="${dbUrl}" npx drizzle-kit push --force`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    console.log(`Migrations completed successfully for ${databaseName}`);
  } catch (error) {
    console.error(`Failed to run migrations on ${databaseName}:`, error);
    process.exit(1);
  }

  console.log(`✓ Test database ${databaseName} is ready for ${testType} tests`);
}

setupTestDatabase().catch((error) => {
  console.error('Failed to setup test database:', error);
  process.exit(1);
});
