import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({ path: resolve(process.cwd(), '../.env'), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://booking:booking@localhost:5432/booking_test';

export default defineConfig({
  test: {
    globalSetup: './src/__tests__/setup.ts',
    // Tests always run against booking_test, never the dev database, no
    // matter what DATABASE_URL is set to outside the test process.
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
