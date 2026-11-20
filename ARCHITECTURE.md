# Architecture

dbtyper parses SQL string literals in the TypeScript type system. This page is the map of the source and of the dialect seam (#51). Requirements live in the spec repo; technical decisions in `DECISIONS.md`.

## Layers

Each file holds one concern (MOD-1); a long concern is split into `name-*.ts` files that the entry file re-exports.

**`src/lexer`**

- `sql-lexer.ts` turns text into tokens and re-exports the token types and `serviceWords`; `sql-lexer-tokens.ts` the token types, `sql-lexer-words.ts` the keyword table, `sql-lexer-chars.ts` characters, operators, spaces, comments and numbers.
- `parser-monad.ts` is the state every parser carries (tokens, `Syntax`, dialect error, source spans).

**`src/parser`: statements**

- `parse-sql-statement.ts` dispatches on the first word and walks a script (`ApplyStatements`); `statement-keywords.ts` the keyword lists; `skip-statement.ts` statements that are skipped to the next `;`.
- SELECT: `parse-select.ts` (entry), `-cte`, `-from`, `-join`, `-list` (select items), `-group-by`, `-order-limit`, `-distinct-on`, `-subquery`, `-resolve` (`*` and names), `-returning` (result accumulator), `-grouped`, `-grouped-valid`, `-grouped-aggregate` (GROUP BY projection rules).
- INSERT: `parse-insert.ts` (entry), `-table`, `-values`, `-select`, `-returning`, `-on-conflict`. UPDATE: `parse-update.ts`, `parse-update-table.ts`. DELETE: `parse-delete.ts`.
- CREATE TABLE: `parse-create-table.ts`, `-columns`, `-merge`, `-sqlite-end`; column parts `parse-column-constraints.ts` (dispatcher), `-constraint-clauses`, `-generated`, `-default`, `-references`, `-alter-end` (ADD COLUMN); `parse-table-constraints.ts`; `parse-sql-type-words.ts`.
- Other DDL: `parse-alter-table.ts` (+ `-add-drop`, `-rename`, `-alter-column`), `parse-alter-type.ts`, `parse-create-type.ts`, `parse-create-domain.ts`, `parse-create-schema.ts`, `parse-create-view.ts`, `parse-drop.ts` (TABLE, VIEW, TYPE), `parse-drop-schema.ts`, `parse-qualified-name.ts`, `parse-qualified-table-name.ts`, `parse-enum-checks.ts`.

**`src/parser`: expressions**

- `parse-expression.ts` (entry; re-exports) with `parse-expression-ast.ts` (AST and env types), `-bool` (AND/OR/NOT, the `ParseExpressionAST` entry), `-relational` (IS, comparisons, ANY/ALL), `-predicates` (IN, BETWEEN, LIKE, CASE), `-arith`, `-primary` (operands, identifiers), `-cast` (CAST, `::`); `parse-function-call.ts` (calls, OVER); `parse-where-expression.ts`.
- `resolve-expression.ts` (AST to type: the per-kind table) with `-compare`, `-case`, `-collections` (array constructor, IN, ANY/ALL, subqueries), `-ident` (identifier chains, parameter lookup), `-params` (parameter probing, NULL propagation); `resolve-column-ref.ts`, `resolve-operators.ts`, `resolve-cast.ts`, `resolve-function.ts`.
- Function catalogs: `function-catalog.ts` is the one row grammar and the `Catalogs` table (rows and hints per catalog kind); `postgres-functions.ts` and `sqlite-functions.ts` are data, one row per function.
- Scope and helpers: `parser-scope.ts`, `scope-unqualified-helpers.ts`, `set-operation-types.ts`, `parser-validate-mutation-value.ts`, `parser-ref-error-third-sentinel.ts`.

**`src/core`**

- Dialect seam: `dialect.ts` (the facts) and `dialect-types.ts` (type-name aliases and cast rows).
- Schema shape: `jsql-shapes.ts`, `jsql-utils.ts` (database, schema, table and type get/replace; re-exports the column operations of `jsql-columns.ts`), `sql-type-shape.ts`, `comparison-classes.ts`.
- Public API: `sql-database.ts` (`DataBase`, re-exports), `sql-migrations.ts` (`sqlMigrations`, `migration`), `sql-driver.ts` (`createDriver`, driver config), `sql-query-types.ts` (query/stream checks and result types), `sql-select-result-helper.ts`, `stream-requires-rows.ts`, `sql-to-ts-conversion.ts`.
- Run-time text: `sql-text-scanner.ts` is the one run-time scanner that skips strings, quoted names, comments and `$$` bodies; the parameter binders use it.
- `param-probe.ts` (parameter types), `type-utils.ts`.

**Elsewhere**

- `src/postgres`, `src/sqlite`: drivers (`dbtyper/postgres`, `dbtyper/sqlite`): run-time adapters plus the type-level driver config (type map, dialect). `bind-colon-named-params-for-pg.ts` binds `:name`.
- `src/dbtyper-error.ts`: every error code with its message; codes are never reused (unused ones become `OBSOLETE_*`).
- `src/index.ts`: the package entry.
- `scripts`: `find-unused-exports.ts` (with `unused-exports-baseline.json`, which may only shrink), `gen-param-stress.mjs`, `create-pr.sh`.

A migration is parsed by `ApplyStatements`, which walks statements with `ParseSqlStatement` and threads the schema type; a query is parsed against the final schema.

## The dialect seam

A chain speaks one dialect, taken from its driver config (`DriverConfig["dialect"]`, `"postgres"` or `"sqlite"`). It reaches the parser as one flag in the lexer's `Syntax` string union (`dialect:postgres` / `dialect:sqlite`), so no parser signature carries a dialect argument.

Rules (the header of `src/core/dialect.ts` is the authority):

- Dialect facts are rows of data (`Dialects`, `DialectOnlyConstructs`, `DialectPhrases`), not conditions spread over parser files. A new fact is a new column or row.
- A construct of the other engine is detected in the token stream and reported with its own code (1900 PostgreSQL-only, 1901 SQLite-only); the first such error is carried by the end-of-text token and reported before any parser error, since it is the root cause.
- Dialect files only add or remove; the same construct never gets a different meaning per dialect.
- The cast rules read `DialectCastRow` rows (`dialect-types.ts`); no known exceptions are listed today.

## Function catalogs

Function result types and nullability are rows in `postgres-functions.ts` and `sqlite-functions.ts`, read through the one grammar and `Catalogs` table of `function-catalog.ts` (FCAT-2); `resolve-function.ts` is the resolver. A dialect's `functionCatalog` fact (`typed` or `affinity`) picks the catalog.

## Tests

`test/integration` holds `*.success.test-d.ts` / `*.error.test-d.ts` type tests and runtime tests; `test/dialects` the SQLite and PostgreSQL cases tagged with spec IDs; `test/infra` checks of the repository itself (every error code is tested, file naming); `test/runtime`, `test/sqlite`, `test/stress`, `test/full`, `test/framework`, `test/error-recovery` the rest.

The gate (`npm run test:ci`): `typecheck:full`, the example typechecks and tests, `node --test` with `DBTYPER_TEST_MIGRATIONS=1`, `lint`, `find-unused` (an export used nowhere fails; the baseline may only shrink) and `format:check` (prettier).
