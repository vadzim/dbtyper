# Decisions

Technical choices made while implementing the spec. Newest first. Each entry names its issue and spec IDs.

## 2026-11-18 Parameter types come from the SQL (#57, track A; CORE-6, CORE-7; PARAM-8…PARAM-11 removed)

- **What replaced the value-derived types.** `InferParamsFromValues`, `TsTypeToSqlType` and `ParamNullable<V>` (#39,
  e594dec) are gone. The values now only say which parameters are given and are checked at the call site; the types
  come from `InferSqlParams` (src/core/infer-param-types.ts). `ParamNullable` differed from CORE-6: nullability
  followed the passed value, now it follows the SQL (`T | null` only for a nullable column of INSERT / UPDATE SET).
- **How.** A token-level scan of the statement (the lexer without the parser monad), not the expression parser: the
  parser resolves and discards its AST in one pass and has no channel to return what it inferred for a parameter,
  and threading one through ~12 parser files is a different, larger change. The scan knows the tables named after
  FROM / JOIN / UPDATE / INTO (alias, schema-qualified) and derives a type from: `column <op> :p` / `:p <op> column`
  (comparison, `LIKE`, `~`, arithmetic on a numeric column), `IN (…)`, `BETWEEN`, `INSERT … (cols) VALUES (…)`,
  `SET c = :p`, `CAST(:p AS t)`, `:p::t`, `LIMIT`/`OFFSET`. The derived shapes are handed to the parser as its
  `Params`, so its own checks (2500, 2507) stay and cannot fail for a derived parameter.
- **Limits (CORE-7 asks for a CAST).** Function arguments (`lower(:x)`), a parameter next to a literal or a
  function result, subqueries' own scopes (the scan merges all tables of the text; an ambiguous unqualified column
  takes the first), `INSERT` without a column list, `VALUES` rows other than flat parameter cells. Each is a
  compile error naming the parameter, never a widened type (P-11); more positions are added as scan rules.
- **Codes.** 2405 `CANNOT_INFER_PARAMETER_TYPE` (message as in CORE-7), 2509 `INCOMPATIBLE_PARAMETER_VALUE_TYPE`
  (a value not assignable to the driver type map's TS type of the derived SQL type; reported on the statement
  argument like the other query errors).
- **Params shape.** Named: a record by name of the given keys only (a missing one keeps 2400); positional: a tuple
  as long as the given array (a missing one keeps 2404). `?` and `$n` are both `$n` in the scan.

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
