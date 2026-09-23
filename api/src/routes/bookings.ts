import { Router } from 'express';
import { z } from 'zod';
import { cursorQuerySchema } from '../lib/cursor.js';
import { requireUser } from '../middleware/auth.js';
import { cancelBooking, listMyBookings } from '../services/booking.js';

export const bookingsRouter = Router();

bookingsRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    const { cursor, limit } = cursorQuerySchema.parse(req.query);
    const { items, nextCursor } = await listMyBookings(req.user!.id, { cursor, limit });
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
});

const bookingIdParamSchema = z.object({ id: z.uuid() });

bookingsRouter.post('/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const { id } = bookingIdParamSchema.parse(req.params);
    const booking = await cancelBooking(id, req.user!.id);
    res.json(booking);
  } catch (err) {
    next(err);
  }
});
