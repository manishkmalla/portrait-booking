import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { slots, users } from './schema.js';

const DEMO_PASSWORD = 'Demo123!';
const SALT_ROUNDS = 10;
const SLOT_COUNT = 20;
const CAPACITY_3_SLOT_INDEX = 5;

// Only seeds when the users table is empty, so it's safe to call on every
// api startup without duplicating demo data on restart.
export async function runSeed<TSchema extends Record<string, unknown>>(db: NodePgDatabase<TSchema>): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (!row || Number(row.count) > 0) {
    console.log('Users table already has data, skipping seed');
    return;
  }

  console.log('Seeding demo accounts and slots...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const insertedUsers = await db
    .insert(users)
    .values([
      { email: 'photographer@demo.test', passwordHash, role: 'photographer' },
      { email: 'alice@demo.test', passwordHash, role: 'client' },
      { email: 'bob@demo.test', passwordHash, role: 'client' },
    ])
    .returning();

  const photographer = insertedUsers[0];
  if (!photographer) {
    throw new Error('Seed failed: photographer user was not inserted');
  }

  const now = new Date();
  const slotRows = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const startsAt = new Date(now);
    startsAt.setUTCDate(startsAt.getUTCDate() + i + 1);
    startsAt.setUTCHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    return {
      photographerId: photographer.id,
      startsAt,
      endsAt,
      capacity: i === CAPACITY_3_SLOT_INDEX ? 3 : 1,
    };
  });

  await db.insert(slots).values(slotRows);
  console.log(`Seeded 3 demo accounts and ${SLOT_COUNT} slots`);
}
