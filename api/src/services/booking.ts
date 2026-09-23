import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { HttpError } from '../middleware/errors.js';
import { bookings, slots } from '../db/schema.js';
import { decodeCursor, encodeCursor } from '../lib/cursor.js';

export type Booking = typeof bookings.$inferSelect;

// The one invariant that matters: a slot can never have more confirmed
// bookings than its capacity, even under concurrent requests. See the
// "Locking approach" write-up in README's Architecture section for why
// SELECT ... FOR UPDATE, taken before counting, is what makes this safe.
export async function bookSlot(slotId: string, userId: string): Promise<Booking> {
  return db.transaction(async (tx) => {
    const [slot] = await tx.select().from(slots).where(eq(slots.id, slotId)).for('update');
    if (!slot) {
      throw new HttpError(404, 'Slot not found');
    }
    if (slot.startsAt <= new Date()) {
      throw new HttpError(409, 'Slot has already started');
    }

    const [row] = await tx
      .select({ count: sql<string>`count(*)` })
      .from(bookings)
      .where(and(eq(bookings.slotId, slotId), eq(bookings.status, 'confirmed')));
    const confirmedCount = Number(row?.count ?? 0);
    if (confirmedCount >= slot.capacity) {
      throw new HttpError(409, 'Slot is full');
    }

    const [booking] = await tx.insert(bookings).values({ slotId, userId, status: 'confirmed' }).returning();
    if (!booking) {
      throw new Error('Insert did not return the created booking');
    }
    return booking;
  });
}

export async function cancelBooking(bookingId: string, userId: string): Promise<Booking> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }
  if (booking.userId !== userId) {
    throw new HttpError(403, 'Forbidden');
  }
  if (booking.status === 'cancelled') {
    throw new HttpError(409, 'Booking already cancelled');
  }

  // Guard on status = 'confirmed' so a concurrent cancel of the same booking
  // can't both "succeed": only one UPDATE actually changes a row.
  const [cancelled] = await db
    .update(bookings)
    .set({ status: 'cancelled' })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed')))
    .returning();
  if (!cancelled) {
    throw new HttpError(409, 'Booking already cancelled');
  }
  return cancelled;
}

export type BookingWithSlot = {
  id: string;
  status: 'confirmed' | 'cancelled';
  slotId: string;
  startsAt: Date;
  endsAt: Date;
};

export async function listMyBookings(
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<{ items: BookingWithSlot[]; nextCursor: string | null }> {
  const decodedCursor = options.cursor ? decodeCursor(options.cursor) : null;

  // Ordered and keyed on the slot's starts_at then the booking's id
  // (upcoming first), matching encodeCursor(startsAt, id) below.
  const cursorCondition = decodedCursor
    ? sql`(${slots.startsAt}, ${bookings.id}) > (${decodedCursor.sortValue.toISOString()}::timestamptz, ${decodedCursor.id})`
    : sql`true`;

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      slotId: bookings.slotId,
      startsAt: slots.startsAt,
      endsAt: slots.endsAt,
    })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(eq(bookings.userId, userId), cursorCondition))
    .orderBy(asc(slots.startsAt), asc(bookings.id))
    .limit(options.limit + 1);

  const hasNextPage = rows.length > options.limit;
  const items = hasNextPage ? rows.slice(0, options.limit) : rows;

  const lastItem = items[items.length - 1];
  const nextCursor = hasNextPage && lastItem ? encodeCursor(lastItem.startsAt, lastItem.id) : null;

  return { items, nextCursor };
}
