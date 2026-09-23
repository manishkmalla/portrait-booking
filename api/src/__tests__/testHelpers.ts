import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';

export async function truncateAll(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE bookings, slots, users RESTART IDENTITY CASCADE`);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
