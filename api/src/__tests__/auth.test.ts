import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { requireRole } from '../middleware/auth.js';
import { closeDb, truncateAll } from './testHelpers.js';

afterEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

const EMAIL = 'newclient@demo.test';
const PASSWORD = 'Password123!';

describe('POST /api/auth/register', () => {
  it('creates a client and sets a cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), email: EMAIL, role: 'client' });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('rejects an invalid body with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets a cookie', async () => {
    await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), email: EMAIL, role: 'client' });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
  });

  it('rejects a wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('rejects an unknown email with 401 and the same error as a wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@demo.test', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['set-cookie']?.[0]).toMatch(/^token=;/);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), email: EMAIL, role: 'client' });
  });

  it('rejects a request with no cookie with 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('rejects a garbage cookie with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-real-jwt');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

// requireRole never touches the response directly (it delegates to
// errorHandler via next()), so tests only need a fake req and a spy on next.
const fakeRes = {} as Response;

// requireRole has no photographer-only route to exercise through yet
// (slots/bookings land in a later phase), so it's tested directly here as
// pure logic with no I/O.
describe('requireRole', () => {
  it('calls next() with no error when the user has the required role', () => {
    const req = { user: { id: 'u1', role: 'photographer' } } as Request;
    const next: NextFunction = vi.fn();

    requireRole('photographer')(req, fakeRes, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() with a 403 HttpError when the user has a different role', () => {
    const req = { user: { id: 'u1', role: 'client' } } as Request;
    const next: NextFunction = vi.fn();

    requireRole('photographer')(req, fakeRes, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, message: 'Forbidden' }));
  });
});
