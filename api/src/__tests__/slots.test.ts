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

function futureIso(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

describe('GET /api/slots', () => {
  it('is public and lists only future slots with remaining places', async () => {
    const photographer = await createUser('photographer');
    const future = await createSlotRow({ photographerId: photographer.id, capacity: 2 });
    await createSlotRow({ photographerId: photographer.id, startsAt: new Date(Date.now() - 60 * 60 * 1000), endsAt: new Date() });

    const res = await request(app).get('/api/slots');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: future.id, capacity: 2, remaining: 2 });
  });

  it('walks every page with no duplicates or gaps', async () => {
    const photographer = await createUser('photographer');
    const total = 25;
    const created = [];
    for (let i = 0; i < total; i++) {
      created.push(await createSlotRow({ photographerId: photographer.id, startsAt: new Date(Date.now() + (i + 1) * 60_000) }));
    }

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const res = await request(app).get('/api/slots').query({ cursor, limit: 10 });
      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = res.body.nextCursor ?? undefined;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual(new Set(created.map((s) => s.id)));
  });
});

describe('POST /api/slots', () => {
  it('lets a photographer create a slot', async () => {
    const photographer = await createUser('photographer');

    const res = await request(app)
      .post('/api/slots')
      .set('Cookie', authCookie(photographer))
      .send({ startsAt: futureIso(60 * 60_000), endsAt: futureIso(2 * 60 * 60_000), capacity: 3 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ capacity: 3, remaining: 3 });
  });

  it('rejects a client with 403', async () => {
    const client = await createUser('client');

    const res = await request(app)
      .post('/api/slots')
      .set('Cookie', authCookie(client))
      .send({ startsAt: futureIso(60 * 60_000), endsAt: futureIso(2 * 60 * 60_000), capacity: 1 });

    expect(res.status).toBe(403);
  });

  it('rejects no auth with 401', async () => {
    const res = await request(app)
      .post('/api/slots')
      .send({ startsAt: futureIso(60 * 60_000), endsAt: futureIso(2 * 60 * 60_000), capacity: 1 });

    expect(res.status).toBe(401);
  });

  it('rejects a startsAt in the past with 400', async () => {
    const photographer = await createUser('photographer');

    const res = await request(app)
      .post('/api/slots')
      .set('Cookie', authCookie(photographer))
      .send({ startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: futureIso(60_000), capacity: 1 });

    expect(res.status).toBe(400);
  });

  it('rejects endsAt <= startsAt with 400', async () => {
    const photographer = await createUser('photographer');

    const res = await request(app)
      .post('/api/slots')
      .set('Cookie', authCookie(photographer))
      .send({ startsAt: futureIso(2 * 60 * 60_000), endsAt: futureIso(60 * 60_000), capacity: 1 });

    expect(res.status).toBe(400);
  });

  it('rejects a datetime with no timezone offset with 400', async () => {
    const photographer = await createUser('photographer');

    const res = await request(app)
      .post('/api/slots')
      .set('Cookie', authCookie(photographer))
      .send({ startsAt: '2099-01-01T10:00:00', endsAt: '2099-01-01T11:00:00', capacity: 1 });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/slots/:id/bookings', () => {
  it('books a slot for a client', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 1 });

    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slotId: slot.id, userId: client.id, status: 'confirmed' });
  });

  it('rejects a photographer with 403', async () => {
    const photographer = await createUser('photographer');
    const slot = await createSlotRow({ photographerId: photographer.id });

    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(photographer));

    expect(res.status).toBe(403);
  });

  it('rejects no auth with 401', async () => {
    const photographer = await createUser('photographer');
    const slot = await createSlotRow({ photographerId: photographer.id });

    const res = await request(app).post(`/api/slots/${slot.id}/bookings`);

    expect(res.status).toBe(401);
  });

  it('rejects a missing slot with 404', async () => {
    const client = await createUser('client');

    const res = await request(app)
      .post('/api/slots/00000000-0000-0000-0000-000000000000/bookings')
      .set('Cookie', authCookie(client));

    expect(res.status).toBe(404);
  });

  it('rejects an already-started slot with 409', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({
      photographerId: photographer.id,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 30 * 60 * 1000),
    });

    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    expect(res.status).toBe(409);
  });

  it('rejects a full slot with 409', async () => {
    const photographer = await createUser('photographer');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 1 });
    const first = await createUser('client', 'first');
    const second = await createUser('client', 'second');

    await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(first));
    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(second));

    expect(res.status).toBe(409);
  });

  it('rejects the same user booking twice with 409', async () => {
    const photographer = await createUser('photographer');
    const client = await createUser('client');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 5 });

    await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));
    const res = await request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client));

    expect(res.status).toBe(409);
  });

  // The concurrency guarantee CLAUDE.md calls "the one invariant that
  // matters": N parallel requests on one slot must produce exactly
  // `capacity` successes and the rest 409, never more successes than
  // capacity even though every request races to read-then-insert.
  it('allows exactly capacity successes under 20 concurrent requests (capacity 1)', async () => {
    const photographer = await createUser('photographer');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 1 });
    const clients = await Promise.all(Array.from({ length: 20 }, (_, i) => createUser('client', `c1-${i}`)));

    const results = await Promise.all(
      clients.map((client) => request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client))),
    );

    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
  });

  it('allows exactly capacity successes under 20 concurrent requests (capacity 3)', async () => {
    const photographer = await createUser('photographer');
    const slot = await createSlotRow({ photographerId: photographer.id, capacity: 3 });
    const clients = await Promise.all(Array.from({ length: 20 }, (_, i) => createUser('client', `c3-${i}`)));

    const results = await Promise.all(
      clients.map((client) => request(app).post(`/api/slots/${slot.id}/bookings`).set('Cookie', authCookie(client))),
    );

    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 409)).toHaveLength(17);
  });
});
