import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Loads the repo-root .env for host-run commands (npm --prefix api dev/test).
// Inside Docker, env vars come from docker-compose's `environment:` blocks
// and no .env is bind-mounted into the container, so this is a silent no-op.
dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().min(1, 'TEST_DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3000),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }
  return result.data;
}

export const config = loadConfig();
