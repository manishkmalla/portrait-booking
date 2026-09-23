# CLAUDE.md — Portrait Session Booking (take-home)

## What this is

A small full-stack app for booking portrait photography sessions, built as an
interview take-home. A photographer publishes time slots; clients log in,
browse slots and book or cancel them. It will be **walked through and extended
live** in an interview, so clarity beats cleverness everywhere.

**The one invariant that matters:** a slot can never have more confirmed
bookings than its `capacity`, even under concurrent requests. Any change that
touches booking or cancellation must preserve this and keep its test passing.

## Constraints and priorities

- **Time box: 4–6 hours total.** Prefer the smallest change that works. Do not
  add features, libraries, abstractions or tooling that weren't asked for.
  If something would take more than ~20 minutes, say so and propose a cut.
- Priority order: (1) standard flows work on a fresh clone, (2) the concurrency
  guarantee is correct and tested, (3) clear README, (4) everything else.
- The developer must be able to explain every line. Write conventional,
  readable code: no metaprogramming, no generic "frameworks", no premature
  layering. Short comments on *why*, especially in the booking transaction.

## Stack

- `api/`: Node 24, TypeScript (strict), Express, Zod, Drizzle ORM + `pg`, bcryptjs, JWT in an httpOnly cookie
- `web/`: React + Vite + TypeScript, plain `fetch` wrapper in `src/lib/api.ts`
- `db`: Postgres 16 in Docker Compose (named volume)
- Tests: Vitest (+ Supertest for API routes)

Before using any package API, check the installed version in the relevant
`package.json`. Do not add a dependency without asking first.

- `api/` and `web/` each commit their `package-lock.json`; Dockerfiles run
  `npm ci` against it for reproducible installs.
- `api/` and `web/` each include a project-local `.npmrc` pinning the public
  npm registry (`registry.npmjs.org`), independent of any registry configured
  in a developer's global npm config.

## Commands

```bash
docker compose up --build            # full stack; migrations + seed run on api start
docker compose down -v               # wipe the DB (use for fresh-clone checks)
docker compose exec api npm test     # API tests — primary path, no host setup needed
docker compose up -d db              # DB only, for running tests/dev on the host instead
npm --prefix api test                # API tests, host-run alternative (needs .env, see below)
npm --prefix api run typecheck
npm --prefix api run db:generate     # after editing api/src/db/schema.ts
npm --prefix web run dev
```

`.env` is optional for `docker compose up --build` — sensible defaults are
baked into `docker-compose.yml`. Copy `.env.example` to `.env` for host-run
commands (`npm --prefix api test`, `npm --prefix api run dev`,
`npm --prefix web run dev`), since Postgres is only reachable at `localhost`
outside Docker's network.

Prefer `docker compose exec api npm test` over the host-run path: running
`docker compose up` first leaves `api/node_modules` and `web/node_modules`
owned by root on the host (anonymous-volume mount points, and neither
container drops root), which makes a later host `npm ci`/`npm install`/
`npm --prefix api test` fail with `EACCES`.

URLs: web http://localhost:5173 · api http://localhost:3000

Seeded accounts (password `Demo123!`): `photographer@demo.test`,
`alice@demo.test`, `bob@demo.test`

## Layout

```
api/src/
  routes/        auth.ts, slots.ts, bookings.ts   # HTTP only: validate, call service, map errors
  services/      booking.ts                       # business logic + transactions
  db/            schema.ts, migrations/, seed.ts, client.ts
  middleware/    auth.ts (requireUser, requireRole), errors.ts
  __tests__/
web/src/
  pages/, components/, lib/api.ts
```

## Rules

**Booking and concurrency**
- Book inside a single transaction: lock the slot row (`SELECT … FOR UPDATE`),
  count confirmed bookings, compare with capacity, insert. Don't restructure
  this without discussing it first.
- A partial unique index prevents one user holding two confirmed bookings on
  the same slot. Map Postgres error `23505` to `409 Conflict`.
- Drizzle wraps the underlying `pg` error in a `DrizzleQueryError`, so the
  Postgres error code lives on `err.cause.code`, not `err.code` — check
  `(err as { cause?: { code?: string } }).cause?.code === '23505'`, confirmed
  while implementing auth's duplicate-email check.
- Cancellation sets `status = 'cancelled'`; never hard-delete bookings.

**API**
- REST with meaningful status codes: 400 validation, 401 unauthenticated,
  403 wrong role, 404 missing, 409 conflict. Error body: `{ "error": string }`.
- Every input (body, params, query) is validated with Zod; derive types with `z.infer`.
- Take the user ID from the auth middleware (`req.user`), never from the request body.
- List endpoints use cursor pagination (`?cursor=&limit=`, limit max 50) and
  return `{ items, nextCursor }`.

**Data**
- Schema lives only in `api/src/db/schema.ts`. After changing it, run
  `db:generate` and commit schema and migration together. Never hand-edit
  generated migrations.
- Parameterised queries only. The `sql` template tag is fine where Drizzle's
  query builder is unclear; never concatenate strings into SQL.
- Fixed-value columns (`users.role`, `bookings.status`) use Drizzle's
  `text(column, { enum: [...] })` plus a Postgres `CHECK` constraint, not
  `pgEnum`. Adding a new value later is a plain `ALTER TABLE ... CHECK`
  migration instead of the more invasive `ALTER TYPE` a Postgres enum needs.

**TypeScript and React**
- `strict: true`, no `any` (use `unknown` and narrow), no unexplained `as` casts.
- Functional components; server data is fetched in page components and passed down.
- No `dangerouslySetInnerHTML`.

**Security (local-app appropriate)**
- Config comes from environment variables read in `api/src/config.ts`.
  `.env` is gitignored; keep `.env.example` complete and up to date.
- Hash passwords with bcryptjs (pure JS; avoids native-module build issues in
  Docker). Never log passwords, tokens or cookies.
- CORS allows only the web origin from config, with credentials.

## Testing

- Tests live in `api/src/__tests__/`, named `<area>.test.ts`.
- Tests use a separate database, `booking_test` (URL from `TEST_DATABASE_URL`),
  never the dev database. Migrations run once in global setup, and tables are
  truncated between tests. Never truncate or seed the dev DB from a test.
- **Integration tests are the default:** exercise routes with Supertest against
  real Postgres. That's where the booking, auth and pagination behaviour lives.
- **Unit tests** only for pure logic with no I/O (e.g. cursor encode/decode,
  Zod schemas). Don't mock the DB or our own modules to create unit tests.
- **Concurrency test (must always pass):** N parallel booking requests on one
  slot produce exactly `capacity` successes and the rest get 409.
  Run it after any change to booking, cancellation or the schema.
- New behaviour gets a test; a bug fix gets a test that would have caught it.
- Test behaviour through the API or service, not implementation details.
- Frontend: no automated tests unless asked (time box); it's verified manually
  via the flows in the README.
- **Never say something works unless you ran it.** Report the actual command and
  result. If you couldn't run it, say so.

## Working agreement

- Don't invent package APIs, file paths or functions. Read or grep first.
  If you can't verify something, say so.
- Before changing auth, the schema or the booking transaction, briefly state
  the plan and wait for approval.
- Keep diffs focused on the task. Don't refactor unrelated code.
- Commits: Conventional Commits, e.g. `feat(bookings): add waitlist`,
  `fix(slots): correct cursor ordering`, `test(bookings): cover capacity > 1`.
- Never run `aws` or `cdk deploy/destroy/bootstrap`. Deployment is done by
  the developer. `cdk synth` and `cdk diff` are fine if an `infra/` folder exists.

## README must always contain

What it is and why · quick start (`docker compose up`) · dummy credentials ·
architecture and how double-booking is prevented · how to run tests ·
time spent · known issues and cuts · what I'd do with more time ·
how AI tools were used. Update it in the same commit as behaviour changes.
