/**
 * Global Test Setup Script
 *
 * Runs once before all tests to:
 * 1. Validate database connection
 * 2. Verify required environment variables
 * 3. Check test data files exist
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Validates database connection
 */
async function validateDatabaseConnection(): Promise<void> {
  console.log('Validating database connection...');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: process.env.DB_NAME || 'change_db',
    ssl: false,
  });

  try {
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log(
      `✓ Database connected successfully: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`
    );

    // Check if required tables exist
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'test_artifacts',
          'playwright_test_results',
          'cypress_test_results',
          'api_events',
          'user',
          'session'
        )
      ORDER BY table_name
    `);

    const existingTables = tablesResult.rows.map((row) => row.table_name);
    console.log(`✓ Found ${existingTables.length} required tables`);

    const requiredTables = [
      'test_artifacts',
      'playwright_test_results',
      'cypress_test_results',
      'api_events',
      'user',
      'session',
    ];

    const missingTables = requiredTables.filter((table) => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.warn(`⚠ Warning: Missing tables: ${missingTables.join(', ')}`);
      console.warn('  Run migrations: npm run db:push');
    }

    client.release();
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Validates required environment variables
 */
function validateEnvironmentVariables(): void {
  console.log('Validating environment variables...');

  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];

  const missing: string[] = [];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    console.error(`✗ Missing required environment variables: ${missing.join(', ')}`);
    throw new Error('Missing required environment variables');
  }

  console.log('✓ All required environment variables present');
}

/**
 * Validates test data files exist
 */
async function validateTestDataFiles(): Promise<void> {
  console.log('Validating test data files...');

  const testDataFiles = [
    'test-run/playwright/results/json/test-results.json',
    'test-run/cypress/results/mochawesome-report/mochawesome.json',
    'test-data/playwright.json',
    'test-data/cypress.json',
  ];

  const missingFiles: string[] = [];

  for (const file of testDataFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    try {
      await fs.access(fullPath);
    } catch {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.warn(`⚠ Warning: Missing test data files:\n  ${missingFiles.join('\n  ')}`);
    console.warn('  Some tests may fail without these files');
  } else {
    console.log('✓ All test data files present');
  }
}

/**
 * Main setup function
 */
async function globalSetup(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Running global test setup...');
  console.log('='.repeat(60));

  try {
    // Load .env.test file if it exists
    const envTestPath = path.resolve(process.cwd(), '.env.test');
    try {
      await fs.access(envTestPath);
      console.log('✓ Found .env.test file');
      // Note: dotenv is loaded by Playwright config
    } catch {
      console.log('ℹ No .env.test file found, using existing environment');
    }

    validateEnvironmentVariables();
    await validateDatabaseConnection();
    await validateTestDataFiles();

    console.log('='.repeat(60));
    console.log('✓ Global test setup complete');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('='.repeat(60));
    console.error('✗ Global test setup failed');
    console.error('='.repeat(60));
    throw error;
  }
}

export default globalSetup;
