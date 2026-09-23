import { Router } from 'express';
import { z } from 'zod';
import { cursorQuerySchema } from '../lib/cursor.js';
import { requireRole, requireUser } from '../middleware/auth.js';
import { HttpError, isUniqueViolation } from '../middleware/errors.js';
import { bookSlot } from '../services/booking.js';
import { createSlot, listSlots } from '../services/slots.js';

export const slotsRouter = Router();

slotsRouter.get('/', async (req, res, next) => {
  try {
    const { cursor, limit } = cursorQuerySchema.parse(req.query);
    const { items, nextCursor } = await listSlots({ cursor, limit });
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

const isoOffsetDateTime = z.iso.datetime({ offset: true });

const createSlotSchema = z
  .object({
    startsAt: isoOffsetDateTime,
    endsAt: isoOffsetDateTime,
    capacity: z.number().int().min(1),
  })
  .refine((data) => new Date(data.startsAt) > new Date(), {
    message: 'startsAt must be in the future',
    path: ['startsAt'],
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

slotsRouter.post('/', requireUser, requireRole('photographer'), async (req, res, next) => {
  try {
    const body = createSlotSchema.parse(req.body);
    const slot = await createSlot({
      photographerId: req.user!.id,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      capacity: body.capacity,
    });
    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
});

const slotIdParamSchema = z.object({ id: z.uuid() });

slotsRouter.post('/:id/bookings', requireUser, requireRole('client'), async (req, res, next) => {
  try {
    const { id } = slotIdParamSchema.parse(req.params);
    const booking = await bookSlot(id, req.user!.id);
    res.status(201).json(booking);
  } catch (err) {
    if (isUniqueViolation(err)) {
      next(new HttpError(409, 'You already have a confirmed booking for this slot'));
      return;
    }
    next(err);
  }
});
