#!/usr/bin/env tsx

/**
 * Apply migration manually
 * This script runs the migration SQL directly using the database connection
 */

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';

// Load .env file if it exists
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

async function main() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: process.env.DB_NAME || 'change_db',
    ssl: false,
  };

  const migrationPath = resolve(process.cwd(), 'lib/db/migrations/0002_groovy_shooting_star.sql');
  if (!existsSync(migrationPath)) {
    console.error(`❌ Error: Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  const pool = new Pool(dbConfig);

  try {
    console.log('🔄 Applying migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
