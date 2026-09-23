# Portrait Session Booking

## What it is and why

_TODO_

## Quick start

```bash
docker compose up --build
```

- web: http://localhost:5173
- api: http://localhost:3000

## Dummy credentials

Password `Demo123!` for all seeded accounts:

- `photographer@demo.test`
- `alice@demo.test`
- `bob@demo.test`

## Architecture and how double-booking is prevented

**The one invariant that matters:** a slot can never have more confirmed
bookings than its `capacity`, even under concurrent requests. Booking
(`POST /api/slots/:id/bookings`, [services/booking.ts](api/src/services/booking.ts))
runs as a single Postgres transaction:

1. `SELECT * FROM slots WHERE id = :id FOR UPDATE` — locks that one slot row.
2. Missing slot → 404. Already started → 409.
3. `SELECT count(*) FROM bookings WHERE slot_id = :id AND status = 'confirmed'`.
4. Count `>=` capacity → 409 (full).
5. `INSERT ... status = 'confirmed'`, then commit.

`FOR UPDATE` takes a row-level exclusive lock on that slot for the whole
transaction. A second transaction trying to `FOR UPDATE` the same row blocks
until the first commits or rolls back — it cannot run its own count-and-
insert until the first one is fully done. Without the lock, two concurrent
requests could both read "1 spot left" before either inserts, and both
insert — capacity exceeded. With it, the second transaction's count always
includes whatever the first one just committed, so it correctly sees the
slot as full once it's full. This relies on nothing more exotic than
Postgres's default `READ COMMITTED` isolation: once the lock is released by
a commit, the next transaction's own `SELECT count(*)` is guaranteed to see
that commit's rows. Only requests against the *same* slot serialize this
way; different slots book fully in parallel, since the lock is per-row.

A partial unique index on `bookings (slot_id, user_id) WHERE status =
'confirmed'` is a second, independent guard against the same user
double-booking the same slot (mapped from Postgres's `23505` to a 409); it
also means a cancelled booking doesn't block rebooking the same slot, since
a cancelled row no longer matches that partial index.

Cancellation doesn't need `FOR UPDATE` — it's one guarded update,
`WHERE id = :id AND status = 'confirmed'`. If that affects no rows, either
the booking never existed or someone already cancelled it; either way the
race is resolved by the guard, not a lock.

This is exercised directly in `slots.test.ts`: 20 concurrent booking
requests against one capacity-1 slot produce exactly 1 success and 19
`409`s, and 20 against a capacity-3 slot produce exactly 3 successes. (We
manually verified this while building it: with `.for('update')` temporarily
removed, the same test let through 10 successes on both — the size of the
Postgres connection pool, not the intended capacity.)

## How to run tests

```bash
docker compose up --build -d
docker compose exec api npm test
```

Alternative (host-run, needs a `.env` copied from `.env.example` since
Postgres is only reachable at `localhost` outside Docker's network):

```bash
docker compose up -d db
npm --prefix api test
```

> **Gotcha:** if you run `docker compose up` before ever running anything on
> the host, `api/node_modules` and `web/node_modules` get created on the host
> as root (they're anonymous-volume mount points, and neither container
> drops root). A later host-run `npm ci`/`npm install`/`npm --prefix api test`
> will then fail with `EACCES`. Either stick to the `docker compose exec`
> path above, or fix it with
> `sudo rm -rf api/node_modules web/node_modules` and reinstall on the host.

> **Adding a dependency:** after `npm install`ing a new package (in `api/` or
> `web/`) and rebuilding, use `docker compose up --build -V` — the `-V`
> recreates the anonymous `node_modules` volumes. Without it, Compose keeps
> reusing the old volume contents on top of the freshly built image, so a
> plain `--build` can silently run with the previous `node_modules`.

## Time spent

_TODO_

## Known issues and cuts

- **No token revocation on logout.** Logout only clears the cookie; the JWT
  itself isn't invalidated server-side, so a copy of the token captured
  elsewhere stays valid until it expires (7 days). There's no session/token
  store to revoke against.
- **Role changes apply on next login, not immediately.** A user's role is
  baked into the JWT at login time, and `requireRole` checks that cached
  role, not the current DB row. `GET /me` re-fetches the DB row so it always
  shows the current role, but a role edited directly in the DB won't affect
  what a still-logged-in user can *do* until they log in again.
- **No rate limiting on login/register**, so both are open to a
  password-guessing loop.

## What I'd do with more time

- Idempotency keys for booking requests. The `bookings.idempotency_key`
  column already exists (unique, nullable) but is intentionally unused this
  phase — a client retrying a timed-out booking request could otherwise end
  up erroring on the resulting `23505` instead of getting back its original
  booking.

## How AI tools were used

_TODO_
