# Portrait Session Booking

## What it is and why

A small full-stack booking app for portrait photography sessions. A
photographer publishes time slots with a capacity; clients register, browse
upcoming availability on a calendar, and book or cancel a session. It's an
interview take-home, so the priority throughout has been a correct,
well-tested core — the booking concurrency guarantee, specifically — over
breadth of features, with code a developer can walk through and extend live
in an interview rather than a black box.

- **API** (`api/`): Node + TypeScript (strict), Express, Zod validation,
  Drizzle ORM over Postgres, JWT auth in an httpOnly cookie.
- **Web** (`web/`): React + Vite, mostly plain CSS. The calendar specifically
  is the one exception: it uses Tailwind CSS + shadcn/ui rather than more
  plain CSS. A hand-rolled plain-CSS calendar came first and worked, but
  wasn't visually polished enough; after weighing the tradeoff (bundle size,
  running a second styling system alongside plain CSS everywhere else), the
  call was made to bring in the real thing for just that one component.
  Adopting Tailwind's global preflight reset surfaced two real bugs in the
  process — both fixed and documented inline in `index.css` and CLAUDE.md: a
  CSS cascade-layers conflict where plain, unlayered button/input rules
  silently overrode Tailwind's own component styling, and native
  form-control text (date/time/number inputs) rendering unreadably under OS
  dark mode because the page never declared `color-scheme: light`.
- See "Architecture and how double-booking is prevented" below for the one
  invariant that matters and how it's enforced under concurrency.

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

### Manual frontend checklist

The frontend has no automated tests (time box — see CLAUDE.md). Verify it
by clicking through these flows against `http://localhost:5173`:

**As a client:**
1. Register with a new email and an 8+ character password.
2. Reload the page — confirm the session restores (still logged in) instead
   of dropping back to the login form.
3. On the Slots calendar, confirm days with availability are visibly marked
   and clickable, and days without aren't.
4. Book a slot — its remaining count should update in place immediately.
   Try booking the same slot again and confirm the resulting `409` ("You
   already have a confirmed booking for this slot") renders inline instead
   of crashing the page.
5. Open My Bookings, confirm the booking shows as "Confirmed" with a Cancel
   button. Cancel it, confirm the status flips to "Cancelled" and the
   button disappears.
6. Go back to Slots and confirm that slot's remaining count is back up.
7. Log out — confirm it returns to the login form.

**As the photographer** (`photographer@demo.test` / `Demo123!`):

8. Confirm the header shows the `photographer` role and a "Create Slot" tab
   in place of "My Bookings".
9. Create a slot: pick a date on the calendar, set a start and end time and
   a capacity, submit, and confirm a success message appears and the form
   clears.
10. Try an invalid one (end time before start time, or a date/time already
    in the past) and confirm the API's validation message renders inline
    without crashing the page.

## Time spent

4 hours, in line with the time box.

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
- Server-side date-range filtering for `GET /api/slots`. The calendar
  currently fetches *all* upcoming slots once (walking cursor pages
  client-side) and groups them by day in the browser — fine at this app's
  scale, but it'd need a real `?from=&to=` query param on the endpoint if
  the number of published slots ever got large.
- Token revocation and login rate limiting (see "Known issues and cuts").

## How AI tools were used

Built end to end with [Claude Code](https://claude.com/claude-code),
following the plan-first, verify-before-code, run-and-report workflow this
repo's own CLAUDE.md already prescribes — a written plan and explicit
approval before touching auth, the schema, the booking transaction, or any
UI redesign; every "it works" backed by an actual command run, including a
real headless browser for frontend changes, not just a passing build.


