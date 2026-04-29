# typed-postgres example

End-to-end flow: **Docker Postgres** → **TS migrations** (typesql `migration()` + `.sql` export) → **`postgres.js`** runner → **typed queries** via `sqlDatabase({ driver: postgresSqlDriver(…) }).compile().connect()` with **`postgresSqlDriver`** from **`typesql/postgres`**.

## Prerequisites

- Docker with Compose v2 (`docker compose`)
- Node 22+ recommended

## One-time / env

Copy env and adjust if needed:

```bash
cp .env.example .env
# Default URL targets docker-compose (port 54333).
```

## Scripts (run from repo root or this folder)

| Script                     | Purpose                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run docker:up`        | Start Postgres in the background                                                                                 |
| `npm run docker:down`      | Stop container **and remove** the named volume (fresh DB next time)                                              |
| `npm run db:migrate`       | Export TS migrations to a temp dir as `.sql`, then execute them in order against `DATABASE_URL`                  |
| `npm run app`              | Print seeded users from `auth.users` (compile-time typed `SELECT`)                                               |
| `npm run demo`             | Same DB access + sample `stream()`                                                                               |
| `npm test`                 | Typecheck plus Node tests (`test/types.test.ts`; integration tests skip unless CI or `RUN_TYPED_PG_INTEGRATION`) |
| `npm run test:integration` | Docker reset → up → migrate → assert seeded users (requires Docker; sets `RUN_TYPED_PG_INTEGRATION`)             |

From repository root (workspace aliases):

```bash
npm run example:docker:up
export $(grep -v '^#' examples/typed-postgres/.env.example | xargs)
npm run example:db:migrate
npm run example:app
npm run example:test
npm run example:test:integration
npm run example:docker:down
```

`db:migrate` prints the temp export directory on stderr (override with `TYPESQL_MIGRATIONS_OUT=/path` to pin a folder).

## Layout

- `docker-compose.yml` — Postgres 16, DB `typesql_example`, port **54333**
- `migrations/*.ts` — SQL strings via `migration(import.meta.url).add(\`...\`)`
- `scripts/migrate.ts` — writes ordered `.sql` files with `postgres`, then runs them (no separate Flyway/Sqitch dependency)
- `src/example-schema.ts` — `compileExampleDb()` chains DDL + seed migrations for **types**
- `scripts/migrate.ts` — consumes `compileExampleDb(...).migrations` directly (same ordering as `.apply(...)`; `apply(..., { hidden: true })` entries are skipped)

### Patches vs migrations (exception)

Some SQL should update the typesql catalog (`apply` → `compile`) but **not** be exported/applied at runtime (e.g. internal parity or temporary adjustments). Mark those call-sites as hidden: `.apply(import("./parity_fix.ts"), { hidden: true })`. Hidden entries still affect types, but are omitted from `compile().migrations` and therefore from `db:migrate`.

## typesql limitations touched here

- Earlier caveats around **`ORDER BY`** typing are largely addressed in the library; this example uses `ORDER BY` in integration tests.
- **Seed `INSERT`** migrations are included in `compileExampleDb()` so compile-time checks align with what `db:migrate` applies.
