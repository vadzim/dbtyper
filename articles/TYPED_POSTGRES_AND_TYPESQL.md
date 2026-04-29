# Typed PostgreSQL with typesql and postgres.js

This post shows a small but practical pattern: use **postgres.js** for runtime access, and use **typesql** to make plain SQL queries type-check against your schema at compile time.

The goal is simple:

- keep writing SQL
- keep using a real PostgreSQL client
- get typed rows back from `query()` and `stream()`
- avoid adding an ORM layer between your code and the database

A runnable version of the setup lives in the `examples/typed-postgres` directory in this repository.

## The problem

SQL is expressive, fast, and usually the best language for data access. The problem is not SQL itself. The problem is the gap between:

- the schema you think you have
- the schema that actually exists
- the query string you typed three files away from both

That gap is where runtime bugs hide:

- wrong table names
- stale column names
- broken joins
- parameter mistakes
- queries that only fail after you deploy

The usual answer is an ORM. That can help in some systems, but it also adds another abstraction layer on top of the database. In practice, that layer often becomes an abstraction tax:

- you stop seeing the SQL that actually runs
- performance becomes harder to reason about
- set-based operations get pulled into object-graph thinking
- the classic N+1 problem comes back through relationship loading and per-row fetches

That last point is the key one. TypeORM and similar ORMs do not invent N+1, but they make it easy to create. You ask for a graph of objects, and the framework may quietly turn that into many small queries. The code looks convenient while the database does more work than you expected.

typesql takes a different path: keep SQL as SQL, and move the correctness check to compile time.

## What typesql does

typesql parses your SQL in the TypeScript type system and checks it against a logical database shape.

That gives you:

- typed query results
- compile-time feedback for invalid SQL
- no query builder syntax to learn
- no ORM model layer to maintain

It does **not** execute SQL inside types. At runtime, you still use a normal PostgreSQL client.

The stack in this post is:

- `postgres` for the runtime client
- `typesql/postgres` as the adapter
- `typesql` for the compile-time database model and typed query surface

## The core pattern

The code below is the heart of the setup.

First, define the logical database once from your migrations:

```ts
import { sqlMigrations } from "typesql"
import type { PostgresDriver } from "typesql/postgres"

export async function exampleDb(driver: PostgresDriver) {
	return sqlMigrations({ driver })
		.apply((await import("../migrations/001.do.schemas.js")).generateSql())
		.apply((await import("../migrations/002.do.users.js")).generateSql())
		.apply((await import("../migrations/003.do.agenda.js")).generateSql())
		.apply((await import("../migrations/004.do.seed_users.js")).generateSql())
		.database()
}
```

Then create the real client and wrap it with the adapter:

```ts
import postgres from "postgres"
import { postgresSqlDriver } from "typesql/postgres"
import { exampleDb } from "./example-schema"

const sql = postgres(process.env.DATABASE_URL!)
const db = await exampleDb(postgresSqlDriver({ sql }))
```

Now `db.query(...)` and `db.stream(...)` are typed against the logical schema.

## Typed queries

With the typed database in hand, queries stay plain SQL:

```ts
const rows = await db.query(`
	select
		u.id,
		u.email,
		a.display_name
	from public.users u
	join public.agenda a on a.user_id = u.id
	order by u.id
`)
```

The result type is inferred from the query and the schema. If you rename a column or break a join, TypeScript catches it before runtime.

That matters most when a query gets copied between files, or when you are editing quickly and want the editor to tell you immediately that you drifted from the schema.

## Streaming rows

The same typed database also supports streaming:

```ts
for await (const row of db.stream("select id, email from public.users order by id")) {
	console.log(row)
}
```

If the driver implements `stream`, rows are fetched incrementally. If it does not, typesql falls back to `query()` and yields the rows one by one.

## Why this is better than an ORM for this use case

I am not saying ORMs are useless. They are fine when you want a high-level object model and the tradeoffs are acceptable.

I am saying they are often the wrong tool for data-heavy PostgreSQL code.

The main issue is the abstraction boundary. With an ORM, you often think in objects first and SQL second. That sounds friendly, but it comes with a cost:

- the database shape becomes indirect
- performance surprises move later in the feedback loop
- N+1 is easier to introduce because the framework can fetch relations lazily or per entity
- advanced SQL features tend to be awkward or under-modeled

For application code that already knows the schema and wants to use PostgreSQL well, plain SQL plus compile-time checking is usually a cleaner fit.

typesql keeps the database visible. That makes the query itself the unit of correctness, which is where it should be.

## Keep schema and types in sync

typesql checks queries against a logical schema. That schema must match the physical database.

So you still need migrations.

The right mental model is:

- migrations own schema changes
- typesql checks queries against the schema produced by those migrations
- PostgreSQL remains the source of truth at runtime

If the schema changes, update the migrations first and then let typesql tell you which queries need to move with it.

## A note on `unsafe`

`postgres.js` exposes `sql.unsafe(...)`. In this setup, that should be used only for trusted strings, or for strings that have already been validated by typesql.

Do not treat `unsafe` as a shortcut for arbitrary user input.

If a query is built from user input, it still needs normal runtime validation and parameterization discipline.

## When this fits well

This pattern works best when:

- you already speak SQL comfortably
- you want to keep using PostgreSQL features directly
- you want typed results without introducing ORM behavior
- you prefer compile-time feedback over runtime surprises

It is especially useful in codebases where database access is a first-class part of the application and where query shape matters.

## Summary

The combination is straightforward:

- **postgres.js** runs the queries
- **typesql** checks the SQL against the schema at compile time
- your code keeps the benefits of raw SQL without giving up type safety

If your current ORM feels like it is turning simple data access into a higher-level object problem, this is a smaller and more explicit alternative.
