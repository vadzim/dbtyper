# Current state vs project goal

**Goal** (from `README.md`): type-safe queries against a schema—wrong tables/columns, bad nullability, and incompatible expressions should surface as **TypeScript type errors** at compile time, not only at runtime.

## What already matches the goal

- **Catalog + scope**: `SELECT` / `DELETE` / `UPDATE` resolve columns against `JsqlDatabaseShape` and `ScopeMap` (including joins).
- **Expressions**: `ParseExpressionAST` + `ResolveExpressionAST` for scalars and booleans; `WHERE` on `DELETE` / `UPDATE` uses `ParseWhereExpression`.
- **DML checks**: `INSERT` / `UPDATE` value expressions checked against column types; `SELECT` projections and `:param` bindings.
- **Parser rules**: token-driven parsers, errors as `SqlParserError<…>` (see `README.md` parser section).

## Implemented in this review (gap closed)

- **`SELECT … WHERE`** was previously skipped (bracket scan only). It now uses **`ParseWhereExpression`** like `DELETE` / `UPDATE`, so invalid filters on a typed `SELECT` are compile-time errors. See `SUPPORTED-SQL.md` (`SELECT`).

## Remaining gaps (prioritized for the goal)

1. **README example vs repo layout** — The README still shows `./src/sql.ts` and `SqlCreateTable` / `SqlSchema`; the thin public barrel is `core/sql.ts` (re-exports only). Either restore a documented `ParseSqlStatement<…, Db, Params>` path in the README or add a small “current API” snippet so newcomers land on the real entry points.
2. **`TODO.md` staleness** — Several bullets are done (typed `IN`, `CAST` / `::`, richer predicates, `SELECT WHERE`). Keep `TODO.md` as a forward backlog only, or merge into this file.
3. **Simple `CASE expr WHEN …`** — Only searched `CASE WHEN …` is implemented.
4. **Other keyword-led `SELECT` items** — `CASE` is wired for non-ident starts; extend the same union if more expression-leading keywords are added to the lexer.
5. **Subqueries / CTEs / views** — High cost; not started.
6. **`ALTER TABLE` / `CREATE INDEX`** — Still skipped at statement level.
7. **Runtime query execution** — Explicitly out of scope per README; no change.

## Performance note

`SELECT WHERE` adds one `ParseWhereExpression` resolution pass on the join scope—same order of work as `DELETE` `WHERE`; keep any future `SELECT` extras behind the same “cheap unless needed” rule from `README.md`.
