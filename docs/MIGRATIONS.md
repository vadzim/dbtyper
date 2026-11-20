## Migrations

Use **`migration(\`…\`)`** for SQL that is a **real migration**: versioned DDL/DML you expect every environment to run in order (including production), and that you typically **export** as `.sql`for your migration runner.`migration(sql)`returns its SQL string unchanged and keeps its literal type, so the SQL is still type-checked when it goes through`apply`.

- Chain those modules with **`sqlMigrations({ driver }).apply(sql)`** (for example `.apply((await import("./001.do.schemas.js")).generateSql())`) so the type-level catalog matches the database.

- **Runtime selection:** Export/apply is driven by the migration modules you include in your migration runner (for examples: all `*.do.*.js` files in the migrations folder).

### Shape

A migration module exports a `generateSql()` function that returns its SQL through `migration(...)`; consumers (like migration runners) select and execute the `*.do.*` modules in order. Complete examples: `examples/typed-postgres/migrations/` and `examples/typed-sqlite-node/migrations/`.

### Testing

When the environment variable `DBTYPER_TEST_MIGRATIONS` is set, `migration()` throws if it is called from a file that is not JavaScript. This repository's tests set it to check that dbtyper works with plain JavaScript migration modules; leave it unset in your application.
