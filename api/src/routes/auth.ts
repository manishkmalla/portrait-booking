import { Router } from 'express';
import { z } from 'zod';
import { COOKIE_NAME, COOKIE_OPTIONS, requireUser } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { findUserByEmail, findUserById, registerUser, signToken, verifyPassword } from '../services/auth.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

// Drizzle wraps the underlying pg error in a DrizzleQueryError, so the
// Postgres error code (23505 = unique_violation) is on `.cause`, not on the
// error itself.
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'cause' in err && (err.cause as { code?: string } | undefined)?.code === '23505';
}

authRouter.post('/register', async (req, res, next) => {
  try {
    // .parse() throws ZodError on invalid input, which errorHandler maps to 400.
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await registerUser(email, password);
    res.cookie(COOKIE_NAME, signToken(user), COOKIE_OPTIONS);
    res.status(201).json(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      next(new HttpError(409, 'Email already registered'));
      return;
    }
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await findUserByEmail(email);
    // Same error for "no such user" and "wrong password" so login can't be
    // used to enumerate registered emails.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      next(new HttpError(401, 'Invalid email or password'));
      return;
    }
    res.cookie(COOKIE_NAME, signToken(user), COOKIE_OPTIONS);
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

authRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    // req.user is set by requireUser; re-fetch so the response reflects the
    // current DB row rather than stale JWT payload data.
    const user = await findUserById(req.user!.id);
    if (!user) {
      next(new HttpError(401, 'Unauthorized'));
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});
