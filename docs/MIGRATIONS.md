## Migrations

Use **`migration(import.meta.url).add(\`…\`)`** for SQL that is a **real migration**: versioned DDL/DML you expect every environment to run in order (including production), and that you typically **export** as `.sql` for your migration runner.

- Chain those modules with **`sqlDatabase({ driver }).apply(import("./….ts"))`** so the type-level catalog matches the database.

- Runtime migration runners can read `compileExampleDb(...).migrations` directly (no filename list required).

- **Hidden call-site flag:** Use `.apply(import("./parity_fix.ts"), { hidden: true })` when SQL must influence compile-time types but should not be exported/applied at runtime. Hidden entries are omitted from `compile().migrations`.

### Shape

Both helpers produce a **`MigrationExport`** default export. Consumers can use this for reporting/labeling, but export inclusion is controlled by the `.apply(..., { hidden: true })` call-site option.
