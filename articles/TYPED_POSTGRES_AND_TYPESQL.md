# Typed PostgreSQL queries with typesql (no ORM)

This article shows how to combine **typesql** (compile-time SQL checking against a schema type) with a small, modern PostgreSQL client—[**postgres**](https://github.com/porsager/postgres) (postgres.js)—so that **plain SQL** strings used at runtime still get **typed rows**: either `Promise<Row[]>` from `query`, or an **async iterator** of rows from `stream`.

A runnable sketch lives under [`examples/typed-postgres/`](../examples/typed-postgres/).

---

## What typesql is solving here

1. **Plain SQL, checked at compile time**  
   You write normal `SELECT` / `WITH … SELECT` text. typesql parses it **in the type system** against your **logical database shape** (usually built from the same migration SQL you already maintain). Wrong tables, columns, joins, or many expression mistakes become **TypeScript errors**, not only runtime failures.

2. **No abstract ORM layer**  
   Frameworks like TypeORM add another language on top of SQL, lag behind PostgreSQL features, and rarely model the full surface you need. **LLMs and humans already know SQL well.** typesql stays close to the SQL you actually run.

3. **Faster feedback for agents (and people)**  
   Just as TypeScript shortens the JavaScript feedback loop, **typesql shortens the SQL feedback loop**: invalid queries surface in the editor and in `tsc`, so **LLM-assisted edits** can be corrected immediately instead of after a round-trip to the database.

typesql does **not** execute SQL in types; it keeps a **type-level** model of the catalog and checks query text against it. You still use a normal driver against a real server.

---

## Pieces

| Piece                         | Role                                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **typesql**                   | `sqlDatabase({ driver })` → `apply(migrationSql)` → `compile()` gives a typed logical DB; `connect()` exposes `query` / `stream` whose row types come from `SqlSelectRow<…>` (same `driver` as in `sqlDatabase`). |
| **postgres** (npm `postgres`) | Modern client: primary API is the `sql` template tag; here we use `sql.unsafe(string)` only for strings **already** vetted by typesql at compile time (or fixed literals).                                        |
| **Bridge**                    | `postgresSqlDriver` from **`typesql/postgres`** implements `SqlDriver` for [postgres](https://github.com/porsager/postgres) (`query` + `stream` via server-side cursor batches).                                  |

---

## Flow

1. **Build the logical schema and wire the driver** — open a **`postgres()`** client, pass **`postgresSqlDriver({ sql })`** as **`sqlDatabase({ driver })`**, then **`apply`** migration SQL and **`compile()`** (see [`examples/typed-postgres/`](../examples/typed-postgres/)):

    ```ts
    import postgres from "postgres"
    import { postgresSqlDriver } from "typesql/postgres"
    import { sqlDatabase } from "typesql"

    const sql = postgres(process.env.DATABASE_URL!)
    const logicalDb = await sqlDatabase({ driver: postgresSqlDriver({ sql }) })
    	.apply(/* migrations */)
    	.compile()
    const app = logicalDb.connect()
    ```

2. **Query with typed rows**:

    ```ts
    const rows = await app.query("select id, name from users;")
    // rows: Array<{ id: …; name: … }> — inferred from the logical schema + this SELECT
    ```

3. **Stream rows** (when `stream` is implemented on the driver, postgres.js uses a server-side cursor):

    ```ts
    for await (const row of app.stream("select id from users;")) {
    	// row is the same object shape as one element of `query`
    }
    ```

If `SqlDriver.stream` is omitted, typesql’s `stream` falls back to `query` and yields each row—typed the same way, but without incremental I/O.

---

## Keeping the database and types in sync

The **logical** schema in TypeScript and the **physical** schema in PostgreSQL must match, or types will lie at runtime.

- Apply the **same** migration SQL to the server (your existing migrator, `psql`, etc.), or
- Generate migrations from the same source of truth you feed to `apply`.

typesql checks **queries** against the type-level catalog; it does not replace migration tooling.

---

## Safety note on `unsafe`

The postgres.js `unsafe()` helper is intended for **trusted** dynamic SQL. Here, the “dynamic” string is often a **template literal type** you already proved against the schema via `query` / `stream`. Do not pipe arbitrary user input into `unsafe()` without a separate, runtime query plan.

---

## Try the example

From the repository root (with npm workspaces):

```bash
npm install
npm run typecheck --workspace @typesql/example-postgres
```

Optional runtime demo (requires a real DB and matching `users` table, or adjust the SQL to match your DB):

```bash
export DATABASE_URL='postgresql://…'
npm run demo --workspace @typesql/example-postgres
```

---

## Summary

- **typesql** = compile-time SQL ↔ schema alignment for **plain SQL**.
- **postgres** = small, capable runtime client with cursors for streaming.
- Together they give **typed `Promise<rows>` and typed async iteration** without giving up full SQL or adding an ORM indirection layer.
