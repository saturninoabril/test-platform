import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'change_user',
    password: process.env.DB_PASSWORD || 'change_password',
    database: process.env.DB_NAME || 'change_db',
    ssl: false,
  },
});
