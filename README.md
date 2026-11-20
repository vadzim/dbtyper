# dbtyper

> Write plain SQL. Get fully typed rows. No ORM. No query builder DSL.

`dbtyper` is a compile-time SQL parser written in the TypeScript type system. It parses SQL string literals against a schema built from your migration chain and turns query results into TypeScript types.

```typescript
const rows = await db.query(`
    SELECT id, display_name as name, email FROM auth.users
`)
// rows: Array<{ id: string; name: string; email: string }>
```

The SQL string stays the source of truth for which columns appear in the result. Rename a column in a migration and stale query/result usage becomes a TypeScript type error before you run the app.

## Setup

Define your database through migrations:

```typescript
import { sqlMigrations, type SqlDriver } from "dbtyper"
import type { PostgresDriver } from "dbtyper/postgres"

export async function exampleDb(driver: SqlDriver<PostgresDriver>) {
	return sqlMigrations({ driver })
		.apply((await import("../migrations/001.do.schemas.js")).generateSql())
		.apply((await import("../migrations/002.do.users.js")).generateSql())
		.apply((await import("../migrations/003.do.agenda.js")).generateSql())
		.database()
}
```

Connect with the Postgres adapter and query with plain SQL:

```typescript
import postgres from "postgres"
import { postgresSqlDriver } from "dbtyper/postgres"

const db = await exampleDb(postgresSqlDriver({ sql: postgres(connectionString) }))

const rows = await db.query(`
    SELECT
        public.agenda.*,
        email,
        display_name
    FROM auth.users
    LEFT JOIN public.agenda
        ON auth.users.id = public.agenda.user_id
    ORDER BY email
`)
```

### SQLite

The same chain works for SQLite: pass a SQLite driver and the chain is parsed as SQLite (type affinity names, `?` parameters, `INSERT OR …`, the SQLite function catalog).

```typescript
import Database from "better-sqlite3"
import { sqlMigrations } from "dbtyper"
import { betterSqlite3Driver } from "dbtyper/sqlite"

const db = sqlMigrations({ driver: betterSqlite3Driver(new Database("app.db")) })
	.apply(`create table users (id integer primary key, email text not null)`)
	.database()
```

`nodeSqliteDriver` does the same for `node:sqlite`; there, more than one statement in a `query` or `stream` is a compile error, because `node:sqlite` runs only the first. The default schema of a SQLite chain is `main`. Syntax of the other engine is a compile error with its own code (1900, 1901). See [Supported SQL](./docs/SUPPORTED-SQL.md) and [Architecture](./ARCHITECTURE.md).

### Driver behaviour

- Parameters the SQL does not use are dropped by the drivers before the statement is sent (extra parameters compile, as the engines would reject them at run time).
- `stream` of a statement that returns no rows rejects, on every driver; use `query` for it.

## Why

The database boundary is usually a hole in TypeScript's type system. Migrations run, columns change, and string SQL only fails at runtime unless you have enough tests. With `dbtyper`, the schema lives in the type system, so migration changes propagate into query errors during the normal TypeScript feedback loop.

This keeps raw SQL readable while avoiding the usual abstraction stack around it: no ORM model layer, no query-builder DSL, no code generation step.

## More

- [Architecture and the dialect seam](./ARCHITECTURE.md)
- [Plain Postgres example](./examples/typed-postgres/README.md)
- [NestJS example](./examples/nest-postgres/README.md)

`queryUntyped` and `streamUntyped` are available for gradual adoption and SQL features the parser does not support yet.

Not production ready yet. It is still alpha. The types shown in the PostgreSQL examples are the alpha's as-built types: they are
checked against a real PostgreSQL through the `postgres` driver (PGT-35), and the few places where the alpha does not type a
spec example yet are marked in that test. To run it, start a PostgreSQL and set `DBTYPER_PG_URL`:

```sh
DBTYPER_PG_URL=postgres://postgres:pg@127.0.0.1:55432/postgres node --test test/runtime/pgt-35-checks-real-postgres.test.ts
```

Without the variable the test is skipped.
