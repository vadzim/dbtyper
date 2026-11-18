# Decisions

Technical choices made while implementing the spec. Newest first. Each entry names its issue and spec IDs.

## 2026-11-18 Result nullability and shapes (#54, track A; CORE-2..5, CORE-13, CORE-14, DML-13, FN-24)

- **Operator nullability in one place.** `ResolveExpressionAST` wraps every resolver in `ApplyOperandNullability`
  (parse-expression.ts): for the kinds listed in `NullPropagatingOperands` (arithmetic, comparison, AND/OR/NOT,
  casts, BETWEEN, LIKE, IN list, ANY/ALL/SOME, custom operators) the result is `Nullable` when any operand
  resolves nullable. Operands are re-resolved, which is a type-alias cache hit, not a second evaluation.
  Null-aware forms (`IS [NOT] NULL`, `EXISTS`) are not in the list, so they stay non-null.
- **Functions.** `ResolveFunctionCall` wraps the old per-function table (now `ResolveFunctionCallBase`): `count`
  non-null; `sum/avg/min/max` always nullable; `coalesce` takes the first non-`NULL`-literal argument's type and
  is non-null when any argument is; every other function is nullable when any argument is. `lag`/`lead` are
  nullable unless a non-null default is given. `sum`/`avg` still return `numeric` (per-dialect types are PGT-27/SQLT-47).
- **CASE** is nullable when any THEN/ELSE branch is (a `NULL` literal branch included); a scalar subquery is
  always nullable (CORE-4).
- **`NULL` alone** is `SqlNull`, and the TS conversion maps it to `null` (CORE-5).
- **No-row statements** (CORE-13, CORE-Q1 option A): `query` of INSERT/UPDATE/DELETE without RETURNING (and DDL)
  is typed `[]`. The internal "no rows" signal is still error 3501 from `SqlSelectResult`; only `stream` reports it.
- **Unmapped types** (CORE-14): `ApplySqlToTsConversion` returns error 3506 naming the first result column type
  that is not a key of the driver's type map; `CheckSqlValid` reports it on the statement. Exempt: `null`, `enum`,
  and the user's own type names (`UserTypeNamesOf<Db>`, enums). `PostgresTypeMap` got explicit `unknown` rows for
  `bytea`, `inet`, `cidr`, `interval`, `tsvector`, `tsquery` so today's results stay; precise types belong to the PGT issues.
- **Not done here:** CORE-1 (PRIMARY KEY makes a column NOT NULL) needs the column/table constraint parser of
  CORE-15 (#63); split out as a remainder issue.

## 2026-11-18 Dialect seam in the type-level parser (#51, track A; DSEL-1, DSEL-3, DSEL-5…DSEL-8, DSEL-11)

- **Where the dialect lives.** `DriverConfig["dialect"]` (`"postgres" | "sqlite"`), declared by the driver's
  type-level config; no separate setting. `sqlMigrations` rejects a driver without exactly one dialect (DSEL-8).
- **How it reaches the parser.** As one flag (`dialect:postgres` / `dialect:sqlite`) added to the lexer `Syntax`
  union by `ParserSyntaxOf<Config>`. Every parser already carries `Syntax` in the parser monad, so no parser
  signature changed and the ~25 parser files stay dialect-free.
- **Data, not conditions.** All dialect facts are rows in `src/core/dialect.ts`: `Dialects` (one row per engine:
  title, other-dialect error, built-in default schema), `DialectOnlyConstructs` (one row per one-engine construct:
  owner, name, hint) and `DialectPhrases` (keyword phrases that are such a construct). Later issues (SQLT-53 list,
  SQLite names and types, PostgreSQL catalogs) add rows; `DialectOnlyError<Syntax, Construct>` is the one question
  code asks.
- **Where the check runs.** In the token stream, not in the parsers: the lexer tags one-token constructs (`$1`,
  dollar strings, backticks), the parser monad matches keyword phrases (`::`, `INSERT OR …`, `REPLACE INTO`) on
  their first word (lookahead only for phrase heads, so ordinary tokens pay one union check). The first error is
  recorded in the monad, the token is still read normally, and the end-of-text token carries the error to
  `ApplyStatements`, which reports it before any parser error (root cause first). Rejected: returning error tokens
  from the lexer (parsers do not propagate them, STMT-Q3); gating in each parser (scattered, misses `::` in DDL);
  exposing the monad's state to parsers (the monad checker allows only `PeekToken`/`SkipToken` to read it).
  Constructs that need parser context (type names, `DISTINCT ON`) call `DialectOnlyError` in their parser.
- **Codes.** 1900 `POSTGRES_ONLY_SYNTAX`, 1901 `SQLITE_ONLY_SYNTAX` (range 1900–1999, other-dialect syntax; DSEL-7).
- **Dialect-neutral parsing.** Without a dialect flag (low-level tests that build `CreateParserMonad`/
  `ApplyStatements` directly) nothing is gated; `sqlMigrations` never parses without one.
- **`ParamsDriverConfig`** rebuilds the config instead of intersecting `syntax`: a driver whose syntax is only
  parameter styles (SQLite) made the intersection `never` for a call without parameters.
- **SQLite default schema.** A SQLite chain starts with its default schema present (SQLT-25's "no create schema");
  naming it `main`/`temp` is left to the SQLite names issue.
