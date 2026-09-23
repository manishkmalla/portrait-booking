import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../app.js';
import { authCookie, closeDb, createSlotRow, createUser, truncateAll } from './testHelpers.js';

afterEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});

describe('GET /api/bookings/me', () => {
  it('rejects no auth with 401', async () => {
    const res = await request(app).get('/api/bookings/me');
    expect(res.status).toBe(401);
  });

  it('lists the current user\'s bookings, including cancelled ones, upcoming first', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const soon = await createSlotRow({ photographerId: photographer.id, startsAt: new Date(Date.now() + 60 * 60_000) });
    const later = await createSlotRow({ photographerId: photographer.id, startsAt: new Date(Date.now() + 2 * 60 * 60_000) });

    const laterBookingRes = await request(app).post(`/api/slots/${later.id}/bookings`).set('Cookie', authCookie(client));
    await request(app).post(`/api/slots/${soon.id}/bookings`).set('Cookie', authCookie(client));
    await request(app).post(`/api/bookings/${laterBookingRes.body.id}/cancel`).set('Cookie', authCookie(client));

    const res = await request(app).get('/api/bookings/me').set('Cookie', authCookie(client));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ slotId: soon.id, status: 'confirmed' });
    expect(res.body.items[1]).toMatchObject({ slotId: later.id, status: 'cancelled' });
  });

  it('only returns the requesting user\'s own bookings', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const otherClient = await createUser('client', 'other');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 2 });

    await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(otherClient));

    const res = await request(app).get('/api/bookings/me').set('Cookie', authCookie(client));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});

describe('POST /api/bookings/:id/cancel', () => {
  it('cancels the owner\'s booking', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id });
    const bookingRes = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    const res = await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`).set('Cookie', authCookie(client));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('frees a place so the same slot can be booked again after cancelling', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 1 });
    const bookingRes = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));
    await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`).set('Cookie', authCookie(client));

    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
  });

  it('rejects cancelling someone else\'s booking with 403', async () => {
    const photographer = await createUser('photographer');
    const owner = await createUser('client', 'owner');
    const stranger = await createUser('client', 'stranger');
    const slot = await createSlotRow({ photographerId: photographer.id });
    const bookingRes = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(owner));

    const res = await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`).set('Cookie', authCookie(stranger));

    expect(res.status).toBe(403);
  });

  it('rejects no auth with 401', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id });
    const bookingRes = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    const res = await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`);

    expect(res.status).toBe(401);
  });

  it('rejects a missing booking with 404', async () => {
    const client = await createUser('client');

    const res = await request(app)
      .post('/api/bookings/00000000-0000-0000-0000-000000000000/cancel')
      .set('Cookie', authCookie(client));

    expect(res.status).toBe(404);
  });

  it('rejects cancelling an already-cancelled booking with 409', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id });
    const bookingRes = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));
    await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`).set('Cookie', authCookie(client));

    const res = await request(app).post(`/api/bookings/${bookingRes.body.id}/cancel`).set('Cookie', authCookie(client));

    expect(res.status).toBe(409);
  });
});
