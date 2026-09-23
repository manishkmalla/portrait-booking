import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// db:generate is a dev-only CLI command; it never opens a DB connection, but
// drizzle-kit's config type still requires dbCredentials for the postgresql
// dialect, so this falls back to the same default as .env.example.
dotenv.config({ path: resolve(process.cwd(), '../.env'), quiet: true });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://booking:booking@localhost:5432/booking',
  },
});
