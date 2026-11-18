# Decisions

Technical choices made while implementing the spec. Newest first. Each entry names its issue and spec IDs.

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
