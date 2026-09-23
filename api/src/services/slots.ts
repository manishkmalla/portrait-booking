import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, slots } from '../db/schema.js';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';

export type SlotWithRemaining = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  remaining: number;
};

export type NewSlot = {
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
};

export async function createSlot(input: NewSlot): Promise<SlotWithRemaining> {
  const [slot] = await db.insert(slots).values(input).returning();
  if (!slot) {
    throw new Error('Insert did not return the created slot');
  }
  return { ...slot, remaining: slot.capacity };
}

export async function listSlots(options: {
  cursor?: string;
  limit: number;
}): Promise<{ items: SlotWithRemaining[]; nextCursor: string | null }> {
  const decodedCursor = options.cursor ? decodeCursor(options.cursor) : null;

  // decoded.sortValue/.id pair from encodeCursor(startsAt, id), matching the
  // slots_starts_at_id_idx index this query is ordered by.
  const cursorCondition = decodedCursor
    ? sql`(${slots.startsAt}, ${slots.id}) > (${decodedCursor.sortValue.toISOString()}::timestamptz, ${decodedCursor.id})`
    : sql`true`;

  // Fetch one extra row so we know whether there's a next page without a
  // separate count query.
  const rows = await db
    .select({
      id: slots.id,
      startsAt: slots.startsAt,
      endsAt: slots.endsAt,
      capacity: slots.capacity,
      confirmedCount: sql<string>`count(${bookings.id}) filter (where ${bookings.status} = 'confirmed')`,
    })
    .from(slots)
    .leftJoin(bookings, eq(bookings.slotId, slots.id))
    .where(and(sql`${slots.startsAt} > now()`, cursorCondition))
    .groupBy(slots.id, slots.startsAt, slots.endsAt, slots.capacity)
    .orderBy(asc(slots.startsAt), asc(slots.id))
    .limit(options.limit + 1);

  const hasNextPage = rows.length > options.limit;
  const page = hasNextPage ? rows.slice(0, options.limit) : rows;

  const items = page.map((row) => ({
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    capacity: row.capacity,
    remaining: row.capacity - Number(row.confirmedCount),
  }));

  const lastItem = items[items.length - 1];
  const nextCursor = hasNextPage && lastItem ? encodeCursor(lastItem.startsAt, lastItem.id) : null;

  return { items, nextCursor };
}
