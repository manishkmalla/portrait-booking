import type { CookieOptions, RequestHandler } from 'express';
import { config } from '../config.js';
import { HttpError } from './errors.js';
import { verifyToken } from '../services/auth.js';

export const COOKIE_NAME = 'token';

// secure only in production: this is a local-app served over http in dev
// (per CLAUDE.md's "local-app appropriate" security section), and a
// secure-only cookie would never be sent back over plain http. sameSite:
// 'lax' covers the web app calling the api on a different localhost port.
export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const requireUser: RequestHandler = (req, _res, next) => {
  const token = req.cookies[COOKIE_NAME] as string | undefined;
  if (!token) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'Unauthorized'));
  }
};

export function requireRole(role: 'client' | 'photographer'): RequestHandler {
  return (req, _res, next) => {
    if (req.user?.role !== role) {
      next(new HttpError(403, 'Forbidden'));
      return;
    }
    next();
  };
}
