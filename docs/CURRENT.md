# Current state vs dbtyper goal

**Goal** (from the first section of `README.md`): type-safe queries against a schema—wrong tables/columns, bad nullability, and incompatible expressions should surface as **TypeScript type errors** at compile time, not only at runtime.

## What already matches the goal

- **Catalog + scope**: `SELECT` / `DELETE` / `UPDATE` resolve columns against `JsqlDatabaseShape` and `ScopeMap` (including joins).
- **Expressions**: `ParseExpressionAST` + `ResolveExpressionAST` for scalars and booleans; `WHERE` on `DELETE` / `UPDATE` uses `ParseWhereExpression`.
- **DML checks**: `INSERT` / `UPDATE` value expressions checked against column types; `SELECT` projections and `:param` bindings.
- **Parser rules**: token-driven parsers, errors as `DbtyperError<Code, Message>` built with `FormatError` from the registry in `src/dbtyper-error.ts` (see `docs/ERROR_CODES.md` and `ARCHITECTURE.md`).

## Implemented in this review (gap closed)

- `SELECT … WHERE` was previously skipped (bracket scan only). It now uses `ParseWhereExpression` like `DELETE` / `UPDATE`, so invalid filters on a typed `SELECT` are compile-time errors. See `SUPPORTED-SQL.md` (`SELECT`).

## Remaining gaps (prioritized for the goal)

1. **Public entry points** — `src/index.ts` exports `sqlMigrations`, `migration`, `createDriver` and the types `DataBase` and `SqlDriver`; the drivers are in `dbtyper/postgres` and `dbtyper/sqlite`. The type-level parser (`ParseSqlStatement<…, Db, Params>`) is internal and not exported.
2. **`TODO.md` / `ROADMAP.md`** — Use **`docs/ROADMAP.md` § Active plan** for **locked priorities** (**A→E**) and **`TODO.md`** (repository root) as the actionable backlog (arrays MVP vs later, **`LATERAL`**).
3. **Simple `CASE expr WHEN …`** — Implemented (discriminant vs each `WHEN` uses `=` comparison-class rules; `THEN`/`ELSE` merge like searched `CASE`).
4. **Select items** — The select list asks the expression parser what is an operand, so a new operand kind needs no change there.
5. **Subqueries / CTEs / views** — Derived tables in `FROM` / `JOIN`, scalar / `IN (SELECT …)` / `EXISTS`, leading `WITH` CTEs and `CREATE VIEW` are covered in `SUPPORTED-SQL.md`. Correlation in `SELECT` list subqueries remains limited (see `TODO.md`). `LATERAL` joins are explicitly deferred past the v1 correlation milestone (`docs/ROADMAP.md`). CTE cycle detection is not implemented.
6. **`CREATE INDEX`** — Skipped on PostgreSQL; on SQLite only the index name is kept, for `INDEXED BY` (SQLT-74; see `SUPPORTED-SQL.md`).
7. **Runtime query execution** — Explicitly out of scope per README; no change.
8. **`SELECT … ORDER BY`** — Typed: ORDER BY never changes the row type; ordering by an output alias works. Gaps are listed in `TODO.md`.

## Performance note

`SELECT WHERE` adds one `ParseWhereExpression` resolution pass on the join scope—same order of work as `DELETE` `WHERE`; keep any future `SELECT` extras cheap unless needed (`DECISIONS.md` records the instantiation cost of each change).
