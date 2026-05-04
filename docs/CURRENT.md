# Current state vs dbtyper goal

**Goal** (from `README.md`): type-safe queries against a schema—wrong tables/columns, bad nullability, and incompatible expressions should surface as **TypeScript type errors** at compile time, not only at runtime.

## What already matches the goal

- **Catalog + scope**: `SELECT` / `DELETE` / `UPDATE` resolve columns against `JsqlDatabaseShape` and `ScopeMap` (including joins).
- **Expressions**: `ParseExpressionAST` + `ResolveExpressionAST` for scalars and booleans; `WHERE` on `DELETE` / `UPDATE` uses `ParseWhereExpression`.
- **DML checks**: `INSERT` / `UPDATE` value expressions checked against column types; `SELECT` projections and `:param` bindings.
- **Parser rules**: token-driven parsers, errors as `SqlParserError<…>` (see `README.md` parser section).

## Implemented in this review (gap closed)

- `**SELECT … WHERE`** was previously skipped (bracket scan only). It now uses `**ParseWhereExpression\*\*`like`DELETE`/`UPDATE`, so invalid filters on a typed `SELECT`are compile-time errors. See`SUPPORTED-SQL.md` (`SELECT`).

## Remaining gaps (prioritized for the goal)

1. **README example vs repo layout** — The README still shows `./src/sql.ts` and `SqlCreateTable` / `SqlSchema`; the thin public barrel is `core/sql.ts` (re-exports only). Either restore a documented `ParseSqlStatement<…, Db, Params>` path in the README or add a small “current API” snippet so newcomers land on the real entry points.
2. `**TODO.md` / `ROADMAP.md`** — Use `**docs/ROADMAP.md`§ Active plan** for **locked priorities** (**A→E**) and`**docs/TODO.md`** as the actionable backlog (function registry typings-only `**InferSqlErrors`**, arrays MVP vs later, `**LATERAL**`, `**GROUP BY`/`HAVING**`).
3. **Simple `CASE expr WHEN …`** — Implemented (discriminant vs each `WHEN` uses `=` comparison-class rules; `THEN`/`ELSE` merge like searched `CASE`).
4. **Other keyword-led `SELECT` items** — `CASE` is wired for non-ident starts; extend the same union if more expression-leading keywords are added to the lexer.
5. **Subqueries / CTEs / views** — **Derived tables** in `**FROM` / `JOIN`**, scalar / `**IN (SELECT …)`**/`**EXISTS**`, leading `**WITH**`CTEs, and`**CREATE VIEW**`are covered in`**SUPPORTED-SQL.md**`. Correlation in `**SELECT**`list subqueries remains limited (see`**docs/TODO.md**`). `**LATERAL**` joins are **explicitly deferred** past the v1 correlation milestone (`**docs/ROADMAP.md`). CTE cycle detection is not implemented.
6. `**ALTER TABLE` / `CREATE INDEX`** — Still skipped at statement level.
7. **Runtime query execution** — Explicitly out of scope per README; no change.
8. `**SELECT … ORDER BY` — Typed row inference for some `ORDER BY` forms can degrade to `never` (see `examples/typed-postgres`: avoid `ORDER BY` in the SQL string and sort in JS). Full `ORDER BY` typing for arbitrary projections is still open.

## Performance note

`SELECT WHERE` adds one `ParseWhereExpression` resolution pass on the join scope—same order of work as `DELETE` `WHERE`; keep any future `SELECT` extras behind the same “cheap unless needed” rule from `README.md`.