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
import { sqlMigrations } from "dbtyper"
import type { PostgresDriver } from "dbtyper/postgres"

export async function exampleDb(driver: PostgresDriver) {
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

## Why

The database boundary is usually a hole in TypeScript's type system. Migrations run, columns change, and string SQL only fails at runtime unless you have enough tests. With `dbtyper`, the schema lives in the type system, so migration changes propagate into query errors during the normal TypeScript feedback loop.

This keeps raw SQL readable while avoiding the usual abstraction stack around it: no ORM model layer, no query-builder DSL, no code generation step.

## More

- [Plain Postgres example](./examples/typed-postgres/README.md)
- [NestJS example](./examples/nest-postgres/README.md)

`queryUntyped` and `streamUntyped` are available for gradual adoption and SQL features the parser does not support yet.

Not production ready yet. It is still alpha.
