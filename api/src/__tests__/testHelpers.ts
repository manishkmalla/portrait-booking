import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { slots, users } from '../db/schema.js';
import { signToken, type AuthUser } from '../services/auth.js';

export async function truncateAll(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE bookings, slots, users RESTART IDENTITY CASCADE`);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// Shared across a test file's users so bcrypt only runs once per run, not
// once per user — the hash's value doesn't matter for these tests, only
// that a valid row (and therefore a valid signed token) exists.
let cachedPasswordHash: string | undefined;

export async function createUser(role: AuthUser['role'], emailPrefix: string = role): Promise<AuthUser> {
  cachedPasswordHash ??= await bcrypt.hash('Password123!', 10);
  const email = `${emailPrefix}-${randomUUID()}@test.local`;
  const [user] = await db.insert(users).values({ email, passwordHash: cachedPasswordHash, role }).returning({ id: users.id, email: users.email, role: users.role });
  if (!user) {
    throw new Error('Insert did not return the created user');
  }
  return user;
}

// Signs a real JWT for a test user without going through /login, so tests
// can set up many authenticated users quickly.
export function authCookie(user: AuthUser): string {
  return `token=${signToken(user)}`;
}

export async function createSlotRow(input: {
  photographerId: string;
  startsAt?: Date;
  endsAt?: Date;
  capacity?: number;
}): Promise<typeof slots.$inferSelect> {
  const startsAt = input.startsAt ?? new Date(Date.now() + 60 * 60 * 1000);
  const endsAt = input.endsAt ?? new Date(startsAt.getTime() + 60 * 60 * 1000);
  const capacity = input.capacity ?? 1;

  const [slot] = await db
    .insert(slots)
    .values({ photographerId: input.photographerId, startsAt, endsAt, capacity })
    .returning();
  if (!slot) {
    throw new Error('Insert did not return the created slot');
  }
  return slot;
}
