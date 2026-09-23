import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { runMigrations } from '../db/migrate.js';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

// Runs once before any test file, migrating booking_test so every test
// starts against an up-to-date schema.
export default async function setup(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://booking:booking@localhost:5432/booking_test';
  await runMigrations(testDatabaseUrl);
}
