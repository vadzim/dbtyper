# typesql

**typesql** is a set of TypeScript types that parse SQL strings and return proper types.

**Where to look next:** supported surface area is summarized in [`docs/SUPPORTED-SQL.md`](docs/SUPPORTED-SQL.md). **Migrations vs internal patches** (`migration()` / `patch()`) are documented in [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md). A short gap analysis vs the goal lives in [`docs/CURRENT.md`](docs/CURRENT.md). A **Docker + migrations + typed queries** walkthrough is in [`examples/typed-postgres/README.md`](examples/typed-postgres/README.md). For **published** installs, import from the `typesql` package; the **`postgresSqlDriver`** adapter lives under **`typesql/postgres`**. In-repo, the minimal type barrel is [`core/sql.ts`](core/sql.ts); statement-level typing lives under `src/parser/` (e.g. [`src/parser/parse-sql-statement.ts`](src/parser/parse-sql-statement.ts)).

Contributor-focused notes (toolchain, build/publish, parser conventions) are in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Goal

The goal is **not** to implement a database with row values or query results living in the type system.

The goal is **type-safe queries against a schema**: when you add or change a migration, any query that no longer matches the catalog (wrong tables or columns, bad nullability, incompatible expressions, and similar) should become a **TypeScript type error**, so incompatibilities surface at compile time—not only when you run the app.
