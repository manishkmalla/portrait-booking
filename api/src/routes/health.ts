import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res, next) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    next(err);
  }
});
