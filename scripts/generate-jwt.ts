#!/usr/bin/env tsx

/**
 * Script to generate JWT tokens for testing and service-to-service authentication
 *
 * Usage:
 *   npm run generate-jwt -- --subject "service-name" --roles "admin,read:events" --expires "24h"
 *
 * Or with tsx directly:
 *   npx tsx scripts/generate-jwt.ts --subject "service-name" --roles "admin,read:events"
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { generateJwtToken, generateJwtSecret } from '../lib/auth/jwt';

interface Args {
  subject?: string;
  roles?: string;
  expires?: string;
  generateSecret?: boolean;
  quiet?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--subject':
      case '-s':
        args.subject = argv[++i];
        break;
      case '--roles':
      case '-r':
        args.roles = argv[++i];
        break;
      case '--expires':
      case '-e':
        args.expires = argv[++i];
        break;
      case '--generate-secret':
        args.generateSecret = true;
        break;
      case '--quiet':
      case '-q':
        args.quiet = true;
        break;
      case '--help':
      case '-h':
        console.log(`
JWT Token Generator

Usage:
  npm run generate-jwt -- [options]
  npx tsx scripts/generate-jwt.ts [options]

Options:
  --subject, -s      Subject (user/service identifier) - required
  --roles, -r        Comma-separated roles (e.g., "admin,read:events,write:events")
  --expires, -e      Token expiration (default: "1h", examples: "24h", "7d", "30m")
  --quiet, -q        Output only the token (for scripts/automation)
  --generate-secret  Generate a new JWT secret for .env file
  --help, -h         Show this help message

Examples:
  # Generate a token for an admin user
  npm run generate-jwt -- -s "admin-service" -r "admin" -e "24h"

  # Generate a token with multiple roles
  npm run generate-jwt -- -s "analytics-service" -r "read:events,read:users" -e "7d"

  # Generate a token in quiet mode (for scripts)
  JWT_TOKEN=$(npm run generate-jwt -- -s "test-script" -r "write:reports" -e "24h" -q 2>&1)

  # Generate a new JWT secret
  npm run generate-jwt -- --generate-secret

Environment Variables Required:
  JWT_SECRET         Secret key for signing tokens (required unless generating new secret)
  JWT_ISSUER         Token issuer (optional, default: "test-platform")
        `);
        process.exit(0);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  // Load .env file
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    // In quiet mode, temporarily suppress console output during dotenv loading
    const originalLog = console.log;
    const originalInfo = console.info;
    if (args.quiet) {
      console.log = () => {};
      console.info = () => {};
    }
    dotenv.config({ path: envPath });
    if (args.quiet) {
      console.log = originalLog;
      console.info = originalInfo;
    }
  }

  // Handle secret generation
  if (args.generateSecret) {
    const secret = generateJwtSecret();
    console.log('\n🔐 Generated JWT Secret:');
    console.log('━'.repeat(80));
    console.log(secret);
    console.log('━'.repeat(80));
    console.log('\n📝 Add this to your .env file:');
    console.log(`JWT_SECRET=${secret}\n`);
    return;
  }

  // Validate required arguments
  if (!args.subject) {
    console.error('❌ Error: --subject is required');
    console.error('Run with --help for usage information\n');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error('❌ Error: JWT_SECRET environment variable is not set');
    console.error('Run with --generate-secret to create a new secret\n');
    process.exit(1);
  }

  // Parse roles
  const roles = args.roles ? args.roles.split(',').map((r) => r.trim()) : ['user'];

  const expiresIn = args.expires || '1h';

  try {
    const token = generateJwtToken(args.subject, roles, expiresIn);

    // Quiet mode: output only the token
    if (args.quiet) {
      console.log(token);
      return;
    }

    // Normal mode: output with formatting
    console.log('\n✅ JWT Token Generated Successfully!');
    console.log('━'.repeat(80));
    console.log('\n📋 Token Details:');
    console.log(`  Subject:    ${args.subject}`);
    console.log(`  Roles:      ${roles.join(', ')}`);
    console.log(`  Expires In: ${expiresIn}`);
    console.log(`  Issuer:     ${process.env.JWT_ISSUER || 'test-platform'}`);
    console.log('\n🔑 Token:');
    console.log('━'.repeat(80));
    console.log(token);
    console.log('━'.repeat(80));
    console.log('\n📝 Usage:');
    console.log(`  curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/events`);
    console.log('');
  } catch (error) {
    console.error('❌ Error generating token:', error);
    process.exit(1);
  }
}

main();
