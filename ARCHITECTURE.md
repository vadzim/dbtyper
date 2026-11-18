# Architecture

dbtyper parses SQL string literals in the TypeScript type system. This page is the map of the source and of the dialect seam (#51). Requirements live in the spec repo; technical decisions in `DECISIONS.md`.

## Layers

| Folder                       | What it does                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lexer`                  | `sql-lexer.ts` turns text into tokens; `parser-monad.ts` is the state every parser carries (tokens, `Syntax`, dialect error).                                                                                                              |
| `src/parser`                 | One file per statement or clause (`parse-select.ts`, `parse-create-table.ts`, `parse-insert.ts`, …), `parse-expression.ts` (expression syntax and AST), `parse-function-call.ts` (calls, OVER), `resolve-expression.ts` (AST to type), `resolve-function.ts`, `resolve-operators.ts`, `resolve-cast.ts`, `resolve-expression-params.ts` (parameter probing and NULL propagation), `postgres-functions.ts` / `sqlite-functions.ts` for the function catalogs. |
| `src/core`                   | The schema shape (`jsql-*`), `sql-database.ts` (the `sqlMigrations(...).database()` API), `param-probe.ts` (parameter types), `dialect.ts` (the seam).                                                                                     |
| `src/postgres`, `src/sqlite` | Drivers (`dbtyper/postgres`, `dbtyper/sqlite`): run-time adapters plus the type-level driver config (type map, dialect).                                                                                                                   |
| `src/dbtyper-error.ts`       | Every error code with its message; codes are never reused (unused ones become `OBSOLETE_*`).                                                                                                                                               |

A migration is parsed by `ApplyStatements`, which walks statements with `ParseSqlStatement` and threads the schema type; a query is parsed against the final schema.

## The dialect seam

A chain speaks one dialect, taken from its driver config (`DriverConfig["dialect"]`, `"postgres"` or `"sqlite"`). It reaches the parser as one flag in the lexer's `Syntax` string union (`dialect:postgres` / `dialect:sqlite`), so no parser signature carries a dialect argument.

Rules (the header of `src/core/dialect.ts` is the authority):

- Dialect facts are rows of data (`Dialects`, `DialectOnlyConstructs`, `DialectPhrases`), not conditions spread over parser files. A new fact is a new column or row.
- A construct of the other engine is detected in the token stream and reported with its own code (1900 PostgreSQL-only, 1901 SQLite-only); the first such error is carried by the end-of-text token and reported before any parser error, since it is the root cause.
- Dialect files only add or remove; the same construct never gets a different meaning per dialect.
- Known exceptions to the rule today (review #116): the dialect-specific type names in the cast rules (`resolve-cast.ts`) still test `typeNames` directly.

## Function catalogs

Function result types and nullability are rows in `postgres-functions.ts` and `sqlite-functions.ts`; `function-param-types.ts` holds argument types shared by both. Consolidating them is planned (#116, items 4, 5, 20).

## Tests

`test/integration` holds `*.success.test-d.ts` / `*.error.test-d.ts` type tests and runtime tests; `test/dialects` the SQLite and PostgreSQL cases tagged with spec IDs. `npm run typecheck:full`, lint and `node --test` are the gate.
