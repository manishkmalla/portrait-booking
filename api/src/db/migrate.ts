import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Uses its own short-lived pool so this can target any database (dev or
// booking_test) independently of the app's long-lived pool in client.ts.
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: resolve(import.meta.dirname, 'migrations') });
  } finally {
    await pool.end();
  }
}
