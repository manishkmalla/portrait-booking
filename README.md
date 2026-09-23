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

_TODO_

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

_TODO_

## How AI tools were used

_TODO_
