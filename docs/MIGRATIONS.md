# Migrations vs patches (exception)

## Normal path: `migration()`

Use **`migration(import.meta.url).add(\`…\`)`** for SQL that is a **real migration**: versioned DDL/DML you expect every environment to run in order (including production), and that you typically **export** as `.sql` for your migration runner.

- Chain those modules with **`sqlDatabase({ driver }).apply(import("./….ts"))`** so the type-level catalog matches the database.
- List the same filenames in your **runtime export list** (e.g. `allMigrationFilenames` in the typed Postgres examples) so `db:migrate` writes and applies them.

## Exception: `patch()` — internal parity / workaround SQL

Use **`patch(import.meta.url).add(\`…\`)`** when you need SQL to participate in **compile-time** schema typing (`apply` → `compile`) but it must **not** be treated as a normal, exported migration.

Typical reasons:

- Bringing the **typesql logical catalog** in line with an **external** database (managed elsewhere) during a codebase migration.
- One-off **fixes** to the representation typesql sees (e.g. constraints or shapes your main migration history does not record) without adding spurious steps to the published migration chain.

### Rules

1. **Mixing:** You may interleave `.apply(import("./real_migration.ts"))` and `.apply(import("./parity_fix.ts"))` in any order the catalog requires; both update the **same** chained type-level DB.
2. **Export list:** Put **`migration()`** modules in `allMigrationFilenames` (or your equivalent). Put **`patch()`** modules only in **`allPatchFilenames`** (see examples), **never** in the main migration list.
3. **Runtime:** Patches are still SQL that must run against your dev DB if you want it to match types — the example **`db:migrate`** script exports and runs patches **after** normal migrations when `allPatchFilenames` is non-empty. Production may omit patches if they only applied to external DBs already.
4. **Discipline:** Name patch files clearly (e.g. `010_internal_catalog_sync.ts`) and comment **why** they exist so they are not mistaken for canonical migrations.

### Shape

Both helpers produce a **`MigrationExport`** default export; **`patch: true`** is set only for **`patch()`**. Consumers (and the example migrate script) use that flag to reject misuse when validating lists.
