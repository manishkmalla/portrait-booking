import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['photographer', 'client'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('users_role_check', sql`${table.role} in ('photographer', 'client')`)],
);

export const slots = pgTable(
  'slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    photographerId: uuid('photographer_id')
      .notNull()
      .references(() => users.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    capacity: integer('capacity').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('slots_capacity_check', sql`${table.capacity} > 0`),
    check('slots_ends_after_starts_check', sql`${table.endsAt} > ${table.startsAt}`),
    // supports cursor pagination ordered by starts_at, id
    index('slots_starts_at_id_idx').on(table.startsAt, table.id),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => slots.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: ['confirmed', 'cancelled'] }).notNull(),
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('bookings_status_check', sql`${table.status} in ('confirmed', 'cancelled')`),
    // one confirmed booking per user per slot; cancelled bookings don't count
    uniqueIndex('bookings_slot_user_confirmed_idx')
      .on(table.slotId, table.userId)
      .where(sql`${table.status} = 'confirmed'`),
  ],
);
