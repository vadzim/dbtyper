# nest-postgres example

Same data path as [typed-postgres](../typed-postgres/README.md) (Docker Postgres → TS migrations → `postgres` runner), but the app is **NestJS**: **`TypesqlModule`** wires `compileExampleDb(postgresSqlDriver({ sql }))` then **`database`** with **`postgresSqlDriver`** from **`typesql/postgres`**, and **`UsersService`** injects the typed `DataBase` via **`@Inject(TYPESQL_DATABASE)`**.

- **Port `54334`** and DB **`typesql_nest_example`** (so it can run beside the plain example on `54333`).
- **`GET /users`** returns JSON rows from **`UsersService.listUsers()`**, which uses typed SQL including **`public.agenda.*`** (qualified table star) on a **`LEFT JOIN`** with **`auth.users`**.
- **`npm run app:cli`** runs **`src/app-cli.ts`**: same **`sample-app`** wiring as plain **`npm run app`**, with a **`JOIN`** query that selects **`public.agenda.*`**, **`email`**, **`display_name`**, a PostgreSQL regex **`WHERE email ~ …`**, and **`ORDER BY`**. Integration tests mirror [typed-postgres](../typed-postgres/README.md) (CLI stdout → `createExampleApp` query → Nest HTTP).

## Prerequisites

- Docker Compose v2
- Node 22+ recommended

## Env

```bash
cp .env.example .env
```

## Scripts

| Script                     | Purpose                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run docker:up`        | Start Postgres                                                                                                                              |
| `npm run docker:down`      | Stop and remove volume                                                                                                                      |
| `npm run db:migrate`       | Export migrations to temp `.sql` and apply                                                                                                  |
| `npm run app:cli`          | Print seeded users via **`sample-app`** (parity with plain **`npm run app`**)                                                               |
| `npm start`                | Nest HTTP API (default port **3000**, override `PORT`)                                                                                      |
| `npm test`                 | Typecheck + `test/types.test.ts` (same shape as plain example)                                                                              |
| `npm run test:integration` | Docker reset → migrate → **`app-cli` stdout** → **`createExampleApp` query** → Nest **`GET /users`** — set **`RUN_TYPED_PG_INTEGRATION=1`** |

From repo root:

```bash
npm install
npm run example:nest:docker:up
export $(grep -v '^#' examples/nest-postgres/.env.example | xargs)
npm run example:nest:db:migrate
npm run example:nest:app:cli
npm run example:nest:start
curl -s http://127.0.0.1:3000/users
npm run example:nest:docker:down
```

## Notes

- **`UsersController`** uses `@Inject(UsersService)` so DI works under **`tsx`** (esbuild does not emit full `design:paramtypes` metadata for constructor injection by type alone).
- **`TypesqlLifecycle`** in `@typesql/nest` resolves shutdown via **`ModuleRef`** for the same reason (see `packages/typesql-nest/DESIGN.md`).

## Layout

- `src/sample-app.ts` / `src/app-cli.ts` — same typed CLI path as plain **`typed-postgres`** (`createExampleApp`, printed rows)
- `src/app.module.ts` — `TypesqlModule.forRootAsync` + `ConfigModule`
- `src/users/` — `UsersService` with **`@Inject(TYPESQL_DATABASE)`**, **`UsersController`** with **`@Inject(UsersService)`**
- `migrations/*.js` — same shape as the plain Postgres example (`migration()` for exported migrations — see **[`docs/MIGRATIONS.md`](../../docs/MIGRATIONS.md)**)
