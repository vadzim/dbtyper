## Migrations

Use **`migration(import.meta.url).add(\`…\`)`** for SQL that is a **real migration**: versioned DDL/DML you expect every environment to run in order (including production), and that you typically **export** as `.sql` for your migration runner.

- Chain those modules with **`sqlDatabase({ driver }).apply(import("./….ts"))`** so the type-level catalog matches the database.

- Runtime migration runners can read `compileExampleDb(...).migrations` directly (no filename list required).

- **Runtime selection:** Export/apply is driven by the migration modules you include in your migration runner (for examples: all `*.do.*.js` files in the migrations folder).

### Shape

Both helpers produce migration SQL via `migration(...)`; consumers (like migration runners) select and execute the `*.do.*` modules in order.
