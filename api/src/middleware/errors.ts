import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

// Thrown by routes/middleware for expected error conditions (401, 403, 404,
// 409, ...); errorHandler below maps it to the given status code.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Drizzle wraps the underlying pg error in a DrizzleQueryError, so the
// Postgres error code (23505 = unique_violation) is on `.cause`, not on the
// error itself.
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'cause' in err && (err.cause as { code?: string } | undefined)?.code === '23505';
}

// Catch-all: known error types map to their status code, anything else is
// an unexpected 500.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map((issue) => issue.message).join('; ') });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
