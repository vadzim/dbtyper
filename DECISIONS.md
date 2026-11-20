# Decisions

Technical choices made while implementing the spec. Newest first. Each entry names its issue and spec IDs.

## 2026-11-20 Review #175 batch 6: run time (track A; #156, #169, #170; RUN-3, RUN-4, RUN-12, RUN-20, SQLT-4, SQLT-7, PARAM-14)

- **#169.** In big-integer mode a SQLite NUMERIC column and every expression typed by its affinity is `number | bigint` (the driver returns a `bigint` for a whole number); the default mode stays `number`. A NUMERIC parameter takes `number | bigint` in both modes.
- **#170.** The drivers leave out values the SQL does not read: SQLite counts positional slots (`?`, `?NNN`, named ones as SQLite numbers them) and the names of `:a`, `@a`, `$a` in one scan (cached per text); PostgreSQL cuts an array at the highest `$n`. `:name` maps already sent only the used keys.
- **#156.** A driver config may carry `singleStatement: true` (node:sqlite only); `ParamsDriverConfig<Config, Values, ForQuery>` keeps it for `query` / `stream` and drops it for `apply`, `ParserSyntaxOf` turns it into the flag `single-statement`, and the statement loop reports the new error 1932 MULTIPLE_STATEMENTS_IN_QUERY when a second statement follows. better-sqlite3 throws at run time for several statements; the compile error was decided for node:sqlite only. An intersection type for the query config cost +1.5M instantiations; the third parameter of `ParamsDriverConfig` costs nothing.
- **RUN-12.** `stream` of a statement without rows rejects with the 3501 text on every driver: node:sqlite looks at `columns()`, PostgreSQL describes the statement first (`.describe()`, one extra round trip, `columns` is empty for NoData).
- **RUN-3.** A driver names the schema its engine starts with (`defaultSchema`: SQLite `main`, PostgreSQL `public`); `sqlMigrations` reads it when no `defaultSchema` is given, so the run-time value matches the type level.
- **RUN-4.** `TEST_MIGRATIONS` is now `DBTYPER_TEST_MIGRATIONS`, no old alias.
- **RUN-20.** `SqliteSqlDriver<Bigint>` and `PostgresSqlDriver<Bigint>` are the `SqlDriver<…>` aliases next to the config types `SqliteDriver` / `PostgresDriver`.
- **Run-time scanner.** `E'…'` strings take a backslash escape (PostgreSQL rows); `:x` after a word, `]`, `)` or `[` is a slice bound, not a parameter; `name in params` became `Object.hasOwn`. test/runtime/sql-text-scanner.test.ts and test/framework/lexer-scanner-cases.test-d.ts read one case table (test/test-utils/scanner-cases.ts). Found: the lexer nests block comments in SQLite, SQLite does not (not fixed here, lexer is batch 1).
- **`.apply()` cost.** The chain type is no longer flattened at every step, only in `database()`: `typecheck:test` 12,235,282 -> 11,932,352 instantiations (-2.5%, with the new tests).

## 2026-11-19 Review #146 leftovers of batches 2 and 3 (track A; DLCT-4, FCAT-2, MOD-1)

- **One SET parser.** `src/parser/parse-set-assignments.ts` parses `col = expr, …` for UPDATE SET and ON CONFLICT DO UPDATE SET (`ParseSetAssignments`, kind `"update"` / `"upsert"`: clause name, error codes and end tokens are one `SetKinds` row) and resolves the values (`ResolveSetAssignments`). UPDATE resolves after FROM, DO UPDATE SET at the end of its list. Behaviour changes: DO UPDATE SET accepts a non-reserved keyword as column name (as UPDATE SET did; test `insert-do-update-set-keyword-column-name`), and a syntax error later in a DO UPDATE SET list now wins over a value error earlier in it (values are resolved after the list, as in UPDATE).
- **Function table in the Dialects row.** `functionRows` and `functionHints` are facts of `Dialects` (src/core/dialect.ts), read through `FunctionRowsOf` / `FunctionHintsOf`; `Catalogs` and `OtherDialectHints` are gone. The constructs and phrase tables moved to `src/core/dialect-constructs.ts` (dialect.ts 443 -> ~330 lines).
- **function-catalog.ts split by concern:** row lookup and predicates (function-catalog.ts), argument-count rules (function-catalog-arity.ts), result codes and nullability (function-catalog-result.ts).
- **Cost:** `typecheck:test` 12,223,813 -> 12,244,305 instantiations (+0.17%).

## 2026-11-19 Dialect seam review, batch 1 (#146, #147; DLCT-2, DLCT-4, DLCT-5, PARAM-15, SQLT-55)

- **`ddl` split** into facts named for rules: `tempObjects`, `schemaStatements`, `unsupportedStatements` (ATTACH/DETACH as data), `constraintOnConflict`, `shortGenerated`, `currentDatetimeType`, `addColumn`. `ddl` stays for `parse-create-view.ts` only (batch 3 splits it).
- **PARAM-15.** `postgresSqlDriver` no longer rewrites `?`; the `$$` fact moved into the `lexer` row (`dollarStrings`; `"dollar-strings"` left `LexerFeatures`). `bind-positional-params-for-pg.ts` is now used only by its test (batch 4 may delete it).
- **SQLT-55.** `ON CONFLICT <action>` on a column or table constraint is checked by one shared `OnConflictClause`; new code 1920 UNKNOWN_CONFLICT_ACTION "Expected ROLLBACK, ABORT, FAIL, IGNORE or REPLACE after ON CONFLICT". A table `ON` not followed by `CONFLICT` is now an error (was skipped).
- **Behaviour notes.** `DROP TYPE` in a SQLite chain is the 1900 phrase error (like `CREATE TYPE`); `CREATE SCHEMA` keeps 1900 and `DROP SCHEMA` 1915 (SQLT-26). `decimal` columns normalize to `numeric` (one alias table). A lexer without a dialect flag lexes `$$` strings.
- **Cost:** `typecheck:test` 11,824,920 -> 11,810,566 instantiations (-0.1%).

## 2026-11-19 Parameter probes: one round binds every probe it finds (#143, track A; CORE-6, CORE-7)

- **Why.** The probe loop (src/core/param-probe.ts) parsed the whole statement once per parameter, and `Params` is a type argument of every parser alias, so nothing is cached between rounds: O(N²), and a WHERE with ~35 parameters hit the 5M instantiation cap (TS2589).
- **How.** `ParamProbeFound` carries a `more` list of further `[key, type]` bindings; `Derive` binds all of them (`BindProbes`, the first binding of a key wins; a later position is checked against it in the next round, as before). Collection points, all inside the existing parser: AND / OR (`MergeBoolBinary` via `CollectParamProbes`), the cells of all VALUES rows (`InsertValuesRowProbes` carries the probes from row to row), UPDATE SET and ON CONFLICT DO UPDATE SET assignments, parameter operands sharing one peer (IN lists, BETWEEN), and the later arguments of a catalog-typed function call.
- **Order kept.** An earlier error is never replaced by a later probe or value (`CollectParamProbes` returns the earlier result unless both are probes): the spike returned the right side when the left was a non-probe error, which swallowed a CORE-7 on the left and the PARAM-14 read mark (a wrong value passed). A peer that is itself an unbound probe is skipped. `:p0 = :p1` after `c0 = :p0` is still CORE-7 (a bound parameter is no peer): bug #145, same on main-track before.
- **Numbers** (TS 7.0.2, `tsc --extendedDiagnostics`): test config 11.83M → 12.06M (with the new test/full/core-6-probes-one-round.test-d.ts); stress config without the new files 24.96M → 16.50M; each new stress file (100 / 150 parameters, 14 statements: WHERE AND and OR, INSERT one row and N/5 rows, DO UPDATE SET, UPDATE SET, IN, a good and a wrong-last-value call each) 9.4M / 16.1M for PostgreSQL, 9.6M / 17.1M for SQLite, every single statement well under the 5M cap. The stress files are generated by scripts/gen-param-stress.mjs.

## 2026-11-19 Runtime robustness: stream binding, migration caller detection, nest test in CI (#137, track A; RUN-4, RUN-12, RUN-17)

- **`stream`** is called as `db.stream(...)` on the driver object (like `query`), so a class-based driver keeps `this`.
- **RUN-4.** `migrationCallerFile(stack)` (src/core/sql-migrations.ts) returns the first stack frame outside dbtyper's own `src/`/`dist/` folder and `node:` internals; frames with or without parentheses, `file://` URLs or paths, any extension. `migration()` under `DBTYPER_TEST_MIGRATIONS` accepts `.js`, `.mjs`, `.cjs` and throws for anything else (`.ts` under tsx). Not solved: with `--enable-source-maps` a compiled `.js` may be reported as its `.ts` source.
- **RUN-17** test is wired into `test:ci` as `node --import tsx --test packages/dbtyper-nest/test/*.test.ts`.

## 2026-11-19 Type-name table for casts, column types, value checks (#128, #135, track A; DLCT-5)

- **One table in `src/core/dialect.ts`.** `DialectCastRow<Db, N>` gives `[result type name, guard]` for a written type name: PostgreSQL reads the data table `NamedCastRows` (an unlisted name is its own type), SQLite gives the type of the name's affinity (`SqliteTypeKey`, now only used inside dialect.ts). `ResolveCastFromShape<Db, Ev, N>` is the single cast rule over that row (guards "no-boolean" / "no-number" give 4503 / 4504); `ResolveCastForDialect` has no dialect branch. `DialectColumnTypeName` (column types, SQLT-17 other-dialect errors) and `ValueMismatchError` (INSERT/UPDATE value check, SQLT-43 vs the PostgreSQL error) moved there too. `CastTypeParts` is gone: a cast AST keeps the written type words in both dialects, the dialect is applied once, where the type is resolved.
- **Comparison rules** need no dialect table: `SameComparisonClass` reads `ComparisonClassOfType` (src/core/comparison-classes.ts), keyed by canonical type names that both dialects produce; nothing translates there.
- **The fact stays `declaredTypes`** ("named" / "affinity"): it now selects how the table reads a name (and whether user types exist), so the name is right.
- **Small behaviour note:** a SQLite cast to a schema-qualified type name (`main.foo`) is classified by its last part (like PostgreSQL's table lookup) instead of the whole dotted string.
- **Cost:** `typecheck:test` 11,321,720 -> 11,334,725 instantiations (+0.1%).

## 2026-11-19 DDL in query is unknown, unused parameters accepted (#136, track A; SCHEMA-6, STMT-Q5, PARAM-14)

- **SCHEMA-6, STMT-Q5.** `ParseSqlStatement` marks the successful result of CREATE / ALTER / DROP and of skipped statements (also TRUNCATE, SET ...) as `{ returning: null; ddl: true }`; `ApplyStatements` keeps the mark; `QueryReturnType` gives `unknown` when the LAST statement is marked, `[]` for INSERT/UPDATE/DELETE without RETURNING (CORE-13). So `truncate table t;` is `unknown` (STMT-18 Check), not `[]`; its test changed.
- **PARAM-14.** A parameter still without a type after the probe loop (src/core/param-probe.ts) is either read by the SQL (CORE-7, 2405) or not read at all. The loop tells them apart by one more parse with that parameter marked `param-read-probe`: both reading sites (`LookupParam`, the select-list one) return the internal error 2406 PARAMETER_PROBE_READ for a marked parameter; no 2406 means unused, and it is bound to `param-unused` (any value passes `CheckParamValues`). No text scan of the SQL.

## 2026-11-19 Unknown leading word is an error (#139, track A; STMT-18, STMT-19)

- **Lists as data**: the skipped-keyword list of each dialect is the `skippedStatements` row of `Dialects` in src/core/dialect.ts (DLCT-1, #144; the shared part in dialect-types.ts); the parsed words and the hint stay in src/parser/statement-keywords.ts. Beyond the spec's list the skipped sets also hold harmless real keywords (VALUES, TABLE, SAVEPOINT, RELEASE, PREPARE, EXECUTE, MERGE, PRAGMA ...), so no valid statement becomes an error. Only the first word is checked; a `(` first token (parenthesised query) is still skipped.
- **Codes.** 1930 UNKNOWN_STATEMENT, 1931 UNKNOWN_STATEMENT_DID_YOU_MEAN. Suggestion = first known keyword one edit away (substitution, insertion, deletion, neighbour swap), words of 4+ letters only; a full edit-distance rule is too costly at type level (TLVL-4).
- **Side fix.** `ALTER TYPE IF EXISTS missing ADD VALUE ...` returned without stepping over the rest of the statement; it only worked because the tail was skipped as a statement. It now skips explicitly.

## 2026-11-19 Dialect facts named for rules (#124, track A; DLCT-4, DLCT-5)

- **DLCT-4.** Fact values no longer carry an engine name: `functionCatalog` and `operators` are `"typed"` (PostgreSQL: result types computed from the argument types) or `"affinity"` (SQLite: the data tables with storage-class results); no file outside `src/core/dialect.ts` compares a fact to `"sqlite"`/`"postgres"`. The name of "the other engine" in the other-dialect function error is derived from the `title` column (`OtherDialectTitleOf`), not written next to the condition.
- **DLCT-5.** The fact `typeNames` is now `declaredTypes` (`"named"`: a declared name is the type; `"affinity"`: it only decides an affinity key, `SqliteTypeKey`), so the type-name table is only reached through dialect.ts names. The cast, column-type and comparison rules stay single (`ResolveCastForDialect`, `DialectTypeName`, `ParseSqlType`), each reading that one fact. Not done: the PostgreSQL-named cast table (`ResolveCastFromShape`) is not rewritten as data over the type-name table; the SQLite path still bypasses it by affinity key. The Check line passes by the grep, but the rule's deeper intent (no rule written in one engine's names) is only partly met.

## 2026-11-19 SQLite example apps (#122, track A; RUN-25)

- **Two examples, same shape** as `examples/typed-postgres`: `examples/typed-sqlite-node` (`node:sqlite`) and `examples/typed-sqlite-better` (better-sqlite3). Migration modules (`migrations/*.do.*.js`) feed both the type chain (`exampleDb`) and a 20-line runtime runner (`src/migrate.ts`, `PRAGMA user_version` as the applied count); no migration library, since SQLite needs none.
- **Wiring.** `test:ci` runs `npm test` of each (build of the root package if `dist/` is missing, typecheck, `node --test`, prettier), which includes the example typecheck; `test:verbose` is unchanged (nothing needs a server).
- **Runtime import of `dbtyper`** goes through `dist/`, so the example `test` script builds the root once (`build:lib`); types resolve to sources through `paths`.
- **Found, not fixed:** on a table with `INTEGER PRIMARY KEY`, a bare `rowid` result column is named after the key at runtime (`id`) but typed `rowid`. The examples alias it (`rowid as rid`). Also `node:sqlite` rows have a null prototype.

## 2026-11-18 PostgreSQL function catalog, JSON and regex operators, data-modifying CTEs (#91, track A; PGT-23…PGT-34; one function requirement removed)

- **Catalog as data, like SQLite's (#76).** `PostgresFunctions` (src/parser/postgres-functions.ts): one row per function,
  `[result, nulls]`, a third item `"aggregate"` (valid before OVER / FILTER) or `"window"` (needs OVER). The dialect row
  `functionCatalog` is now `"postgres" | "sqlite"` (was `"builtin"`); `ResolvePgFunctionCall` is the PostgreSQL path of
  `ResolveFunctionCall` and `ResolveWindowFunction`. Result codes `arg`, `arg2` (`date_trunc`), `common` (`greatest`,
  numeric widening), `first-value` (`coalesce`), `sum`/`avg` per argument type (PGT-27), `array-of-arg`, `text[]`; the
  null rules are those of SQLite's catalog (`IsResultNullable`, exported). Arity errors (FN-5, FN-7…FN-10, FN-12, FN-24)
  are data too (since batch G a column of the row: `ArityRules` in src/parser/function-catalog.ts, which holds the shared grammar and the one resolver's helpers). `array_length`, `array_append`, `array_prepend`, `unnest` (FN-19…FN-21, own
  error codes) are rows too (#116 batch G: result codes `array-length` … `unnest`). This is what fixes the
  3619 that #76 left on `current_timestamp` and `replace(...)` in a PostgreSQL chain.
- **PGT-34.** `PostgresSqliteOnlyFunctions` (hint table, mirror of `SqlitePgOnlyFunctions`): `Unknown function: ifnull.
ifnull() is SQLite-only; use coalesce(a, b)`, code 3619 (FN-1).
- **Old "no OVER on functions" requirement removed (was FN 14).** An aggregate with OVER is typed (PGT-33); any other name with OVER is 3619. The test
  `select-unknown-window-function` became `fn-1-unknown-window-function`; code 2402 is `OBSOLETE_2402_…`.
- **Call syntax.** `extract(field FROM x)` (field becomes a string argument), `position(a IN b)`, `substring(s FROM a FOR b)`,
  `trim(BOTH x FROM s)`: `ParseCallArgs`. `left(` / `right(` are identifiers in the lexer when `(` follows (PostgreSQL
  chains only). `interval '1 day'`, `date '…'` typed literals are casts. A function call may now be the left operand of
  arithmetic (`now() - interval '1 day'`, `count(*) - 1`; it was a parse error). `timestamp ± interval`, `timestamp -
timestamp` (interval), `date ± integer`, `date - date` (integer): `PgDatetimeArithmetic`.
- **Operators.** `SIMILAR TO` (keyword `similar`; dialect phrase row `similar to`), `?` as an operator (a parameter `?` is
  still PARAM-5; the lexer yields a key token only in PostgreSQL chains), `->` / `#>` give the operand's json type
  (nullable), `->>` / `#>>` nullable text, `@> <@ ? ?| ?&` boolean (nullable when an operand is, for json operands; array
  `@>` stays non-null as before). `LIMIT ALL` (phrase row `limit all`), `DISTINCT ON (…)`: parsed before FROM and
  resolved against the FROM scope (`DistinctOnError`), unknown columns give 2300 "in DISTINCT ON"; the rule that the
  ORDER BY starts with the same expressions is not checked.
- **PGT-25.** Constraint names given with `CONSTRAINT name` while a CREATE TABLE is parsed travel in the database state
  (`pendingConstraints`) and end in the table's `constraints: { names }`; `ALTER TABLE ADD|DROP CONSTRAINT name` update
  them. `ON CONFLICT ON CONSTRAINT n` accepts those and the default names `<table>_pkey`, `<table>_<col>_key` (not
  checked against the table's keys); anything else is the new error `UNKNOWN_CONSTRAINT` (2220). `OVERRIDING {SYSTEM|USER}
VALUE` after the column list: a `GENERATED ALWAYS AS IDENTITY` column is `generated: true, identity: true` in the
  facts (the column state `gen` is `"identity"`); it is writable only with OVERRIDING (3512 otherwise); stored generated
  columns are never writable.
- **PGT-26.** `WITH x AS (INSERT | UPDATE | DELETE … [RETURNING …])`: the statement's own parser runs with `cteDml` in the
  state and its finisher accepts `)` instead of `;`; the CTE has the RETURNING columns (none without). Dialect fact
  `dmlInCte` (SQLite: still the 1101 error). The main statement after the WITH must be a SELECT.
- **PGT-32 FROM.** `unnest(array)` and `generate_series(a, b[, step])` are FROM items (`ParseFromFunction`): the call is
  resolved by the expression parser in the scope of the items before it (`JOIN unnest(t.tags) AS x(v)`); the column is
  named by the column alias, else the alias, else the function name. Comma joins in FROM do not exist in this parser
  (as before), so use `CROSS JOIN`.
- **Not done / limits.** Function
  parameter types (now the `params` column of the rows) got no new rows (PGT-17's area).
- **Cost.** Existing tests 8.52M -> 8.70M instantiations (+2.1%), the stress config 10.93M -> 10.98M (+0.5%); the new
  test adds 1.23M.

## 2026-11-18 Parameter widenings and PostgreSQL DDL (#88, track A; PGT-17..21; one schema requirement removed)

- **PGT-17**: only the timestamp rows were new in `PostgresParamTypeMap` (`Date | string` for `timestamp[tz]` and the long
  names); `bigint`/`numeric` (#79) and `json[b]` (`JsonValue` in both maps) were already there.
- **ADD COLUMN in PostgreSQL** now uses the CREATE TABLE column parser (as SQLite did): the full definition is accepted
  (DEFAULT, NOT NULL, identity, REFERENCES, ...), and `, <next action>` may follow. The SQLite-only restrictions (no
  PRIMARY KEY/UNIQUE, NOT NULL needs DEFAULT, statement ends) are gated by `DialectFact<Db, "ddl">`. A missing type is
  still 1607.
- **Identity columns**: `GENERATED ALWAYS | BY DEFAULT AS IDENTITY [(options)]` is NOT NULL; ALWAYS is `generated`
  (not insertable; PGT-25's OVERRIDING is not done), BY DEFAULT is optional in INSERT. `DEFERRABLE`, `NOT DEFERRABLE`,
  `INITIALLY ...` are skipped in column and table constraints.
- **ALTER TABLE**: `SET DEFAULT` / `DROP DEFAULT` change the `default` fact; `ADD [CONSTRAINT n] PRIMARY KEY (cols)` marks
  the columns NOT NULL; other constraints and `DROP CONSTRAINT`, `ENABLE|DISABLE|FORCE ROW LEVEL SECURITY`, `OWNER TO`,
  `ALTER COLUMN ... ADD GENERATED / DROP IDENTITY` are skipped (a dropped primary key keeps NOT NULL: not tracked).
  `TYPE t USING expr` and `SET DATA TYPE` work.
- **Root fix**: `SET NOT NULL`, `DROP NOT NULL` and an added primary key only set the `nullability` fact (read by INSERT);
  SELECT reads the column's own type, so they changed nothing. `JsqlTableReplaceColumnNullability` now also sets
  `nullable` on the column type, and `ALTER COLUMN TYPE` keeps NOT NULL.
- **Views**: `CREATE OR REPLACE VIEW` (replaces a view, not a table) and `CREATE MATERIALIZED VIEW ... [WITH [NO] DATA]`
  are views; `DROP MATERIALIZED VIEW` is `DROP VIEW`. `with` ends a FROM item (it cannot be an alias).
- **Skip list (PGT-21)** was already the behaviour of unknown statements; the new test pins it.
- **#47 repro** (`alter table t add primary key (id); select 1 as x;`) is a test.
- Cost: test config 9,115,079 -> 9,330,083 instantiations (`tsgo --singleThreaded`), the new test file included.

## 2026-11-18 One long statement: recursion shapes (#105, track A; bug)

- **Select list.** `MergeStringRecords` (parse-select.ts) forces the record's properties each step (the ForceProps shape
  of #48); lazy layers failed with TS2589 at about 50 items. 170+ items (1,000+ tokens) now pass; 350 still do (the
  merge is quadratic in keys, so about 400 items hit the 5M-instantiation limit).
- **AND / OR chains.** The parser no longer builds a left-nested tree (depth = operators; TS2589 at ~40, TS2321 on
  structural checks). Operands are collected tail-recursively in chunks of 16, each chunk and then the chunk list is
  balanced into a tree of the same `and`/`or` nodes (depth log2 n). AND/OR are associative for typing, so results and
  first-error order are unchanged. A plain growing tuple was quadratic in instantiations (TS2589 at ~240 operators) and
  a cons list is itself deeper than the depth limit, hence the chunks. 400 comparisons (1,600 tokens) pass, 600 do not.
- **Joins** already passed at 1,000 tokens (130 joins); the test pins it.
- **Cost.** Existing tests 9.96M -> 10.49M instantiations (+5%); the new test adds 7.7M (18.2M in all).

## 2026-11-18 SQLite function catalog and PostgreSQL-only syntax (#76, track A; SQLT-44…SQLT-53)

- **Catalog as data.** `SqliteFunctions` (src/parser/sqlite-functions.ts) has one row per function: `[result, nulls]`
  (`[…, "window"]` for functions that need OVER); `max/1` and `min/1` are the aggregate rows, chosen by argument count.
  The dialect row `functionCatalog` ("builtin" | "sqlite") picks the path in `ResolveFunctionCall` and
  `ResolveWindowFunction`; the PostgreSQL path is the old code under the new names `ResolveBuiltinFunctionCall` /
  `ResolveBuiltinWindowFunction`. Null rules per CORE-2 are names in the row (`args`, `all` for coalesce/ifnull, `tail`
  for iif, `lag`, `null`, `non-null`). Common type of arguments: equal types stay, numbers widen to real, else `any`.
  `typeof` is a new type name of the SQLite type map (the literal union of storage class names), non-null.
- **Parameters.** Rows added to `FunctionArgTypes` (`instr`, `unicode`) and to `PeerTypedFunctions` (`ifnull`, `max`,
  `min`); the table is shared by both dialects because a name has one argument type.
- **SQLT-52.** A name outside the table is 3619; a PostgreSQL function with a SQLite replacement (table
  `SqlitePgOnlyFunctions`) gets the hint in the message: `Unknown function: now. now() is PostgreSQL-only; use datetime('now') or CURRENT_TIMESTAMP`.
  The 3619 code is kept because FN-1 names it; DSEL-7 codes are for syntax.
- **CURRENT_DATE/TIME/TIMESTAMP** are operands of the expression parser (a `function_call` without parentheses) and
  select-list items; in a PostgreSQL chain they are the unknown-function error until the PostgreSQL catalog (PGT)
  types them. `replace`, `extension` are accepted as names (`NonReservedWords`); `grant`, `lateral`, `extension` became
  keywords so that their phrases can be matched.
- **Window clause.** In a SQLite chain `OVER ()` and frames (`ROWS|RANGE|GROUPS …`) are accepted (frame skipped), and
  `FILTER (WHERE …)` after an aggregate is parsed; the PostgreSQL window grammar (FN-11) is unchanged: the new code only
  runs where PostgreSQL had an error (`CloseWindowOrError`). The FILTER and OVER contents are not resolved (as before).
  A window-only function without OVER is 3620. Aggregate detection for GROUP BY (`KnownAggregateName`) knows `total`,
  `group_concat`, `string_agg`, `json_group_*` and treats `min`/`max` with 2+ arguments as scalar.
- **SQLT-53.** One-word and phrase constructs are `DialectPhrases` rows (`array [`, `[ ]`, `ilike`, `@>`, `<@`, `&&`,
  `lateral`, `create type|schema|extension`, `grant`, `conflict on constraint`, `fetch first|next`). Parser-context
  ones use `DbDialectOnlyError<Db, construct>` (the state's dialect, like `DialectFact`): `ANY/ALL/SOME` after a
  comparison, `DISTINCT ON`, `DELETE … USING`, PostgreSQL-only type names in column types and `CAST` (`PgOnlyTypeNames`
  rows: timestamptz, timestamp/time with time zone, jsonb, uuid, bytea). `DISTINCT ON` is checked by the parser because
  a parse error right after `DISTINCT` hid the token-stream error. A bug fixed on the way: a phrase head with no
  matching phrase (`create table …`) made `MatchDialectPhrase` `never`, which matched the destructuring and gave a
  union of all errors; guarded in parser-monad.ts.
- **Cost.** Existing tests 7.95M -> 8.05M instantiations (+1.2%); the new tests add 0.39M (8.43M in all).

## 2026-11-18 SQLite DDL and names (#70, track A; SQLT-18…SQLT-29)

- **One flag, `ddl`, in the `Dialects` row** gates every SQLite DDL rule through `DialectFact<Db, "ddl">`; no parser says
  `if sqlite`. A PostgreSQL chain pays at most one conditional per statement or constraint keyword.
- **Schemas (SQLT-25/26).** A SQLite chain starts with `main` (the default schema, whatever the config says) and
  `temp`. `main.t` / `temp.t` are ordinary qualifiers; any other qualifier is the existing unknown-schema error.
  `UnqualifiedSchema<Db, Name>` (jsql-utils) is the one place that asks "temp first, then main"; every FROM / INSERT /
  UPDATE / DELETE / DROP / ALTER site uses it instead of `Db["defaultSchema"]`. `CREATE TEMP TABLE|VIEW` pass a `Temp`
  flag. `CREATE SCHEMA` is the SQLT-53 PostgreSQL-only error (hint "SQLite has no schemas"), `DROP SCHEMA` is 1915.
- **CREATE TABLE (SQLT-18/19).** Short `AS (…)`, `ON CONFLICT` after NOT NULL / UNIQUE / PRIMARY KEY (the type parser
  already swallows `NOT NULL`, so `ON` is also handled where a constraint is expected) and after table constraints,
  `ASC|DESC` after PRIMARY KEY, WITHOUT ROWID needs a PRIMARY KEY (1913). `DEFAULT CURRENT_*` is accepted for any column.
- **ALTER TABLE (SQLT-20/21).** ADD COLUMN in a SQLite chain reuses the CREATE TABLE column parser (`ColumnCtx.alter`):
  the definition ends at `;`; PRIMARY KEY / UNIQUE (1914), NOT NULL without DEFAULT (1914) are errors. `RENAME TO` moves
  the table (both dialects). `ALTER COLUMN`, `ADD CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK` are phrase rows
  (`pg-alter-column`, `pg-add-constraint`): the PostgreSQL-only error of DSEL-5.
- **Statements (SQLT-22/23/24).** `CREATE VIEW [IF NOT EXISTS] v (cols) AS` (column list reuses the CTE one);
  `CREATE TRIGGER` is skipped to the `END` that does not close a `CASE`; other unknown statements were already skipped.
  `CREATE VIRTUAL TABLE`, `ATTACH`, `DETACH` are 1916.
- **Names (SQLT-27/28/29).** In a SQLite chain the lexer lower-cases quoted identifiers too (`"x"`, `` `x` ``, `[x]`;
  `[…]` stays brackets when empty or holding `,` `'` or a leading digit, so `text[]` and `array[1, 2]` keep SQLT-53) and
  an identifier written with capitals carries `written`; a column reference and an `AS` alias use it as the result key.
  Adjacent string literals are not concatenated; `X'…'` is a blob literal (`blob: true` on the string token and AST).
  Not done: the expression-text key (`count(*)`); parsers cannot read the source text (the monad hides it), and the
  bare-column-with-aggregate query of the SQLT-28 Check is rejected by the GROUP BY rule.
- **Fixed on the way.** INSERT … SELECT never checked its columns and returned `never` (the Db was lost, so a rebuild
  migration could not continue): the select is parsed after its keyword and compared by the select's `order`.
- **Cost.** Existing tests (test config, without the four new files) 8.43M → 9.57M instantiations; the PostgreSQL path
  is about +1.5%, the SQLite tests double (1.06M → 2.06M, not yet attributed). New tests add 0.9M.

## 2026-11-18 SQLite type names, affinity, keys and rowid (#67, track A; SQLT-6…SQLT-17)

- **Dialect facts for parsers come from the database state, not from the monad.** The monad checker lets parsers read
  the monad only through `PeekToken`/`SkipToken`, so `Syntax` is unreachable in them. A SQLite chain's database state
  carries `dialect: "sqlite"` (`JsqlDatabaseShape.dialect`, set in `InitialDatabase`, kept by `FlattenedJsqlDatabase`);
  `DialectFact<Db, Fact>` (src/core/dialect.ts) reads a row of the `Dialects` table, and a state without the field is
  PostgreSQL (unchanged behaviour and cost). New rows: `typeNames` ("named" | "affinity"), `pkImpliesNotNull`,
  `rowidTables`, `typelessColumns`. No parser file says `if sqlite`.
- **A declared type becomes its affinity key** (`SqliteTypeKey`, data in dialect.ts): `integer | real | text | numeric |
blob`, plus `boolean` (SQLT-9: the type map says `number`, `bigint` in big-integer mode, and comparisons already
  give `boolean`), `any` (no type or `ANY`, SQLT-10) and text for DATE/DATETIME/TIMESTAMP/TIME/JSON (SQLT-8). The shape
  type names are keys of `SqliteTypeMap` (extended with numeric, boolean, any, bigint). `CAST(x AS t)` is mapped to the
  same key when the AST is built (`CastTypeParts`), so `ResolveCastFromShape` is unchanged.
- **Columns remember what SQLite decides at the end of the table.** `ColumnDef` got `pk` (`single`/`composite`) and the
  declared type name; `ParseSqliteTableEnd` reads the table options (`STRICT`, `WITHOUT ROWID`), checks STRICT type
  names (1910), then sets NOT NULL for primary keys of STRICT/WITHOUT ROWID tables and for the rowid alias (a single
  column declared exactly `integer`, also optional in INSERT through the `default` fact). `ParseSqlType` returns the
  declared name only when asked (`KeepDeclared`), to keep it out of column types.
- **rowid** (`rowid`/`oid`/`_rowid_`): a SQLite table with a rowid has `rowid_table: true` (`JsqlCreateRowidTable`,
  also for CREATE TABLE AS). FROM items of SELECT/UPDATE/DELETE expose the names through `TableScopeColumns` (a
  real column of that name wins); the shapes carry `pseudo: true`, which `VisibleColumnsOf` drops from `*` and `t.*`.
  INSERT does not see them.
- **Codes.** 1910 `STRICT_TABLE_TYPE_NOT_ALLOWED`, 1911 `AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY`, 1912
  `EXPECTED_TABLE_OPTION_IN_CREATE_TABLE`. SERIAL (SQLT-17) is the 1900 other-dialect error (construct `pg-serial`,
  hint "Use INTEGER PRIMARY KEY").
- **Cost.** Check of the existing tests +1.8% instantiations (7.31M → 7.44M); the new SQLite tests add 0.25M.
  Statement-loop depth is limited (60/500-statement tests): keep the PostgreSQL path free of extra alias layers.

## 2026-11-18 Parameter types from the expression parser (#99, track A; CORE-6, CORE-7)

- **Replaces the token scan** of #57 (`InferSqlParams`, infer-param-types.ts is gone). The parser itself gives a
  parameter its type; no second copy of the SQL rules.
- **How (src/core/param-probe.ts).** The statement is parsed with each given parameter bound to a probe
  (`SqlParamProbe`, type `"param-probe"`). The first position that can type a probe returns the error
  `ParamProbeFound<key, type>` (an ordinary parser error with a payload, so every parser already propagates it);
  `DeriveQueryParams` binds that type and parses again, until no probe is found. A probe left over, or one that
  only meets other parameters, is CORE-7 (2405). The parser's own error stops the loop and is the result.
  Cost: one extra parse per parameter that is typed this way (test config 4.70M -> 4.97M instantiations with the new tests).
- **Where positions type a probe.** `ParamProbeAt` in `ResolveExpressionAST` (resolve-expression-params.ts): operands
  that share a type (comparison, arithmetic (numeric peer only), LIKE / `~`, BETWEEN, IN list; the peer is the first
  operand that is not a parameter and resolves to a type; a literal counts, so `:x + 1` is an integer), `CAST` and `::`,
  function arguments (table `FunctionArgTypes` in function-param-types.ts; `coalesce`, `nullif`, `greatest`, `least`
  follow their other arguments). `ValidateMutationValueForColumn` (INSERT VALUES, UPDATE SET, DO UPDATE SET) gives the
  column's type, nullable kept. `LIMIT` / `OFFSET` give integer. Comparison-like positions give a non-null type.
- **INSERT without a column list** is parsed: the columns are all columns of the table in declaration order.
- **Behaviour changes.** `:x + 1` is no longer CORE-7 (test renamed core-6-param-next-to-literal). A value given
  for a key that the SQL never uses is now CORE-7 for that key (it has no position). An unqualified column shared by
  several tables is the parser's ambiguity error, not "first match".
- **Not typed (CORE-7):** arithmetic functions (`abs(:x)`), a parameter next to `NULL`, `ORDER BY :x`, a bare select item.

## 2026-11-18 SQLite drivers on track A: dialect, parameter forms, ?NNN (#65 track-A part; DSEL-1, SQLT-3, SQLT-4, SQLT-30)

- `SqliteDriverConfig` declares `dialect: "sqlite"` and `syntax: "question-params" | "named-params"`. `indexed-params`
  is PostgreSQL's `$1`, so it is not a SQLite form; `dollar-strings` neither.
- The lexer reads `@name` and `$name` (named, like `:name`) and `?NNN` (numbered, like `$n`) only when the chain's
  `Syntax` has `dialect:sqlite` (and `named-params` / `question-params`); under PostgreSQL `@` stays an operator and
  `$name` keeps its old meaning. Bare names bind objects (SQLT-30), so no new parameter kind was needed.
- Rows are typed from `SqliteTypeMap` by the shape's type name (integer, real, text, blob): SQLT-3/SQLT-4 Checks run
  in test/dialects/sqlt-30-\*.test-d.ts. The declared-type to affinity mapping is the SQLT type-names issue (#67).
- The better-sqlite3 adapter no longer retries a failed bind: `usesNumberedParams(sql)` scans the text (outside string
  literals, quoted names, comments) and an array is bound as `{1: …, 2: …}` exactly when the SQL has `?NNN`.

## 2026-11-18 Set operations, USING/NATURAL, any ON, recursive CTEs, DO NOTHING (#60, track A; CORE-8..12, CORE-20)

- **Set operations** (`ParseSelectCompound`): one SELECT arm, then a left-associative tail of `UNION|INTERSECT|EXCEPT [ALL|DISTINCT]`.
  Arms are matched by position, but select results are unordered records, so a result now carries `order`
  (the output names as a tuple, built from the select list; `select *` / `t.*` use a union-to-tuple of the column
  names, declaration order in practice). `MergeSetOperation` (set-operation-types.ts) takes the first arm's names, the common
  type (same type: left's `arg`; numeric classes widen smallint < integer < bigint < numeric < real < double;
  a `NULL` arm yields the other type nullable) and nullable if either side is. Errors 3408 (count), 3409 (types).
  An `ORDER BY`/`LIMIT` after the last arm is parsed by that arm (against its own scope), not the whole compound.
- **USING / NATURAL**: scope entries got an optional `hidden` column union (parser-scope.ts). The right table's
  shared columns are hidden from unqualified lookup and from `alias.*`; the left column carries the merged
  nullability (inner/left: left; right: right; full: nullable only if both are). `a.id`/`b.id` stay valid.
  A `USING` column missing on either side is 3411. `NATURAL` with no common column is a cross join.
- **ON** is `ParseWhereExpression` (clause name "JOIN ON"). Code 2506 (the old join-on type mismatch) is retired and never reused; a
  type mismatch is now 2500 like in WHERE.
- **Duplicate output names** (CORE-11, 3410) are checked from the same `order` tuple, so `a.*, b.*` with a shared
  name is also rejected. RETURNING lists are not checked yet.
- **WITH RECURSIVE**: `ParseCteBody` parses `non-recursive UNION [ALL] recursive`; the recursive arm sees the CTE under
  its own name with the first arm's columns, and the CTE's final columns are the merged result. `WITH name (cols)`
  renames by position. A CTE now sees earlier CTEs (`ParseSelectExpression` got a `CteBase` argument).
- **ON CONFLICT DO NOTHING** accepts an optional target; no assigned columns; RETURNING is unchanged.
- Unaliased expressions in multi-item select lists still need `AS`, also in union arms.

## 2026-11-18 Parameter types come from the SQL (#57, track A; CORE-6, CORE-7; four parameter requirements removed)

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

## 2026-11-18 Result nullability and shapes (#54, track A; CORE-2..5, CORE-13, CORE-14, DML-13, FN-24)

- **Operator nullability in one place.** `ResolveExpressionAST` wraps every resolver in `ApplyOperandNullability`
  (resolve-expression-params.ts): for the kinds listed in `NullPropagatingOperands` (arithmetic, comparison, AND/OR/NOT,
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

## 2026-11-18 CREATE TABLE constraints, DEFAULT checks, generated columns, DROP VIEW, CREATE TABLE AS (#63, track A; CORE-15..19, DML-4, STMT-16; two schema requirements removed)

- **One constraint loop in the existing parser.** After the column type, `ParseColumnConstraints` reads constraints in any
  order (NOT NULL, NULL, DEFAULT, PRIMARY KEY, UNIQUE, CHECK, REFERENCES, COLLATE, GENERATED ALWAYS AS, each with an
  optional `CONSTRAINT name`) until `,` or `)`. Table constraints (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY) are read in
  the same body loop. A column is the tuple `[name, type, notNull, hasDefault, generated]`; a PRIMARY KEY (inline or
  table-level, CORE-1) sets `notNull` and the type's `nullable: false`. Facts are built inline in `OneCol` (an alias
  `ColumnFacts<...>` made type-checking 2-4x slower on chains of NOT NULL tables).
- **Monad linearity.** The monad checker forbids reading one monad twice after a skip, and forbids helper aliases for
  look-ahead, so each constraint keyword has its own small parser entered AT the keyword (`ColumnNotNull`,
  `ColumnPrimaryKey`, ...), and two-token look-ahead is `SkipToken<T> extends infer R1` then `PeekToken<R1>`.
- **DEFAULT is typed like an INSERT value (CORE-16).** The default expression goes through `ParseExpressionAST` /
  `ResolveExpressionAST` with no columns and no parameters in scope, and is compared with `SameComparisonClass`; a
  mismatch is 2507 naming the column. `NULL` fits any column. `CURRENT_TIMESTAMP` / `CURRENT_DATE` / `CURRENT_TIME` are
  handled in the DEFAULT parser (the expression parser has no such keywords). An unknown function (3619) is accepted
  unchecked: function catalogs belong to the dialect issues (PGT-18, SQLT-19). An unknown column inside a function call
  keeps the old 5001 "Expected `)` after function name in DEFAULT" (SCHEMA-15). Codes 5200-5204 are removed with the removed schema requirement.
- **REFERENCES (CORE-17).** The target table must exist (2200 / 2214 with context REFERENCES) and a named target column
  must exist (2300); a self reference is accepted and its columns are not checked (the table is not built yet). The
  referenced column is not required to be a key. Actions (`ON DELETE|UPDATE`, `MATCH`) are skipped.
- **Generated columns (CORE-18).** `generated: true` fact; INSERT column list, UPDATE SET and ON CONFLICT DO UPDATE SET
  naming one is 3512; a NOT NULL generated column is omittable in INSERT (DML-4). The expression is not typed.
  `GENERATED ... AS IDENTITY` (PGT-6) and SQLite's short `AS (...)` (SQLT-18) are left to the dialect issues.
- **CREATE TABLE AS (CORE-19)** reuses `ParseSelectExpression`; every output column is made nullable. **DROP VIEW**
  is `parse-drop-view.ts` (3511 missing, 3510 targets a table; CASCADE/RESTRICT accepted).
- **COLLATE** ends the type-word scan (`CollectSqlTypeWords`), so `text COLLATE "C"` is the type `text`.
- **STMT-16:** the 500-statement migration compiles as is; test added.

## 2026-11-18 PostgreSQL scalar type map (#79, track A; PGT-1..11, PGT-35)

- **The map is what `postgres` returns by default** (src/postgres/postgres-type-map.ts, data only, no alias layer in the
  parser): `int8`/`numeric`/`decimal` and `count(*)` are `string`; dates and timestamps `Date`; `time`, `interval`, `inet`,
  `cidr`, `macaddr`, `money`, `xml`, `tsvector`, `tsquery`, `bit` `string`; `bytea` `Uint8Array`; `json`/`jsonb` the exported
  `JsonValue`. This replaces the explicit `unknown` rows of #54 (CORE-14). Aliases are still folded by `NormalizeSqlTypeName`.
- **PGT-3: the driver parsers of #43 are removed** (base commit 6b587ab): dbtyper never touches `sql.options.parsers`.
- **PGT-4**: `PostgresDriverConfig<Bigint>`, switched by `postgresSqlDriver({ sql, bigint: true })` (overload), mirrors the
  SQLite config; it is type-level only: the user's client must parse int8 to BigInt itself.
- **Parameters**: `PostgresParamTypeMap` (the existing `paramTypes` field) keeps `bigint`/`numeric`/`decimal` values accepting
  `string | number | bigint`, so existing inserts keep compiling; the other PGT-17 widenings stay with the params issue.
- **Not done / notes**: PGT-35 was later run against a real PostgreSQL in 7a48e96 (feat/a-pgt35, opt-in `DBTYPER_PG_URL`), with the README note; the
  recursive `JsonValue` is compared by assignability in tests (the invariant check is too deep). Cost: +0.03% instantiations
  (9.825M -> 9.828M); the new type test adds 0.13M.

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

## 2026-11-18 SQLite parameters, operators, joins and DML (#73, track A; SQLT-30…SQLT-43)

- **Dialect rows** (src/core/dialect.ts), no `if sqlite` in a parser: `operators` ("sqlite" = `||` TEXT for any operands, `->`
  TEXT, `->>` any/nullable, from the data table `SqliteOperators` next to `SqliteFunctions`), `isOperand` (`IS [NOT] value`
  and `IS [NOT] DISTINCT FROM`, null-safe, never NULL), `globRegexp` (`GLOB`, `REGEXP`), `limitComma` (`LIMIT m, n`). Existing
  facts reused: `typeNames: "affinity"` now also decides that a CAST gives the affinity's type (any value, boolean included)
  and that a literal with `.`/exponent is REAL and arithmetic with a REAL operand is REAL (bigint mode shows it).
- **Parameter values (SQLT-32).** `DriverConfig.paramTypes` (optional) is the TS type per SQL type that a VALUE may have; the
  SQLite config sets `SqliteParamTypeMap` (integer position: `number | bigint`, no boolean/Date/object). Postgres has none, so
  its values are still checked against `scalarTypes`. Mixing `?` and `:n` is the existing lexer error 1007; `:a`/`@a`/`$a` were
  already one key; disagreeing types are 2500.
- **Expressions.** New AST kind `is_cmp`. Postfix `NOT LIKE/GLOB/REGEXP/IN/BETWEEN` is the negated positive form (also for
  PostgreSQL); the unparenthesized column DEFAULT parses with `noPostfixNot` so `DEFAULT 18 NOT NULL` still ends the
  expression (the monad cannot un-skip a token). `ESCAPE x` is parsed and dropped. `GLOB`/`REGEXP` are plain identifiers
  in the token stream (no new keywords). `REGEXP` is allowed only when `Db["functions"]` has `regexp`.
- **INSERT.** `[OR action]` after INSERT/UPDATE, `REPLACE INTO` as a statement head, `DEFAULT VALUES`, conflict target
  `WHERE`, any number of chained `ON CONFLICT` clauses (only the last DO UPDATE's column list is kept in the result),
  `RETURNING` after DO UPDATE with `*` meaning the target's columns (no `excluded`). INSERT sees the rowid names: the target
  scope and column list use `TableScopeColumns`; the no-column-list default stays the real columns. (#67 leftover.)
- **UPDATE … FROM.** SET values are parsed first (kept as `pending`) and resolved after FROM/WHERE scope exists, so they may
  name FROM sources; FROM reuses the SELECT FROM/JOIN parser (`ParseFromJoinScope`), so joins work.
- **Not changed (already met).** RIGHT/FULL joins and their nullability, DML in a CTE/subquery (1101/1102 syntax errors),
  `FETCH FIRST` and `DELETE … USING` (1900), non-STRICT value checks (2507).
- **Codes.** 2510 `COLUMN_TYPE_MISMATCH` ("column `name` is TEXT", SQLite chains; PostgreSQL keeps 2507), 1917 `REGEXP_NEEDS_FUNCTION`, 1918 `EXPECTED_CONFLICT_ACTION_AFTER_OR`, 1226 `EXPECTED_VALUES_AFTER_DEFAULT_IN_INSERT`,
  5008 `EXPECTED_FROM_AFTER_IS_DISTINCT`, 5009 `EXPECTED_LIKE_IN_OR_BETWEEN_AFTER_NOT`.
- **Cost.** SQLite test files before this issue 2,791,410 instantiations, same files after 2,803,379 (+0.4%); the three new
  test files add ~1.5M by themselves (whole `tsconfig.test.json`: 9.18M → 11.96M).

## SQLT-28: result key as written (#101, track A)

- **Source text for parsers.** Parsers cannot read the query text (monad checker: only `PeekToken`/`SkipToken`).
  In a SQLite chain (`dialect:sqlite` in `Syntax`) the monad adds `from`, the text a token was read from, to every
  token it holds; a parser reads two tokens with `PeekToken` (start and end of an expression) and `SourceSpan`
  subtracts them. Other dialects get no `from`: zero cost. Rejected: a mark stack in the monad (needs new monad
  primitives and changes the checker's contract); printing the AST back (second copy of the SQL syntax, loses spacing).
- **Facts.** `exprKeys` ("name" | "text") and `groupByRule` (SQLite allows bare columns with an aggregate) are rows
  of `Dialects`. An item without alias that is not a column or `*` keeps its text in `key`, used only for naming.
- **Limits.** Leading comments inside the span stay in the key; SQLite itself keeps the text too. An implicit alias
  without `AS` is not parsed by the select list (existing behaviour).

## 2026-11-18 Arrays, enums, domains, unmapped types (#82, track A; PGT-12..15, PGT-22; four type requirements removed)

- **Enum columns are shapes `{ type: "enum", arg: [name, schema] }`**, resolved when the column type is parsed
  (`ResolveUserType` in parse-sql-type-words.ts: the table's schema, then the default schema, then any schema). The
  labels are NOT copied into the shape: `JsqlEnumLabelUnion` reads them from the chain when a result or parameter is
  typed, so `ALTER TYPE ... ADD VALUE` changes the union (PGT-13). `SqlTypeShapeToTs`/`ApplySqlToTsConversion` take the
  chain as an extra argument; the old "user type names are not unmapped" exemption is gone.
- **Domains** are `{ kind: "domain", base, notNull }` in the schema's `types` (src/parser/parse-create-domain.ts); a
  column of a domain gets the base shape, NOT NULL when the domain says so (not for arrays of it). DEFAULT/CHECK are skipped.
  `DROP DOMAIN` and `ALTER DOMAIN` are still skipped statements; not done.
- **Arrays** nest per dimension in `SqlTypeShapeToTs`; an unmapped element type is CORE-14 (the check already recursed).
- **PGT-14** lives in src/parser/parse-enum-checks.ts, called from `=`/`<>`/..., `IN`, `BETWEEN`, simple `CASE` and
  INSERT/UPDATE assignment (the literal's AST is needed, shapes alone cannot tell a label). Codes: VALUE_NOT_IN_ENUM 2511
  "'x' is not a value of enum mood"; INCOMPATIBLE_VALUE_FOR_ENUM 2512 "Incompatible value for enum mood" (number,
  boolean, another enum). A non-literal text operand is accepted. Casts `'x'::mood` give the enum shape; the label of a
  cast literal is not checked. Parameters compared with or assigned to an enum are typed as the label union.
- **CORE-14 message** now ends with "; select it with a cast, e.g. `::text`" (PGT-15 hint).
- **Not done**: see "Comparison classes" (#85) for the leftovers of this entry; they are done there.
- Cost: instantiations of the full test typecheck 9.828M -> about 10.5M including the new test file (0.13M-0.2M).
- **CORE-14 hint per dialect** (#107): the cast spelling is the `castHint` row of `Dialects` (`::text` / `CAST(x AS TEXT)`); message 3506 takes it as its second argument. SQLite `->` is a `["text", "null"]` row (SQLT-36).

## 2026-11-18 Comparison classes, untyped string literals (#85, track A; EXPR-26, PGT-16, DML-16, TYPE-15)

- **Classes are data** in src/core/comparison-classes.ts: `ComparisonClassOfType` (type name -> class; unknown names are
  "unknown"), `StringLiteralClasses` (the classes a literal fits besides text: uuid, datetime, enums), `EnumClass`
  (`enum:schema.name`, one class per enum). `SameComparisonClass<L, R, LAst?, RAst?>` takes the operands' ASTs: a
  non-blob string literal is compatible with a `StringLiteralClasses` class. interval, inet and json[b] are class
  "unknown" and take it anyway. Callers that have the AST pass it: `=`..., `BETWEEN`, `IN` (either side), simple CASE,
  CASE results (the AST of the first non-null branch is carried: the CASE keeps its type, EXPR-20), INSERT/UPDATE values
  and a column DEFAULT. Set operations and INSERT..SELECT have no literal, so no AST.
- **Enum vs another class is 2500 / 2504 / 2507 now** (the enum is a class), so INCOMPATIBLE_VALUE_FOR_ENUM (2512) is
  removed. src/parser/parse-enum-checks.ts only does the label check (2511) for a literal; a text column against an
  enum is an incompatible comparison (PostgreSQL has no `text = enum` either).
- **Leftovers of #82 done**: `COALESCE` / `NULLIF` / `GREATEST` / `LEAST` over an enum check literal arguments
  (`EnumPeerCheck`, row `PeerCheckedFunctions`); `IN` with a literal on the left; the label of a cast literal
  (`'x'::mood`, `CAST('x' AS mood)`, `'x'::app.status`: a dotted cast type is kept as `schema.name`, `app.` + `status`);
  `schema.enum` in column types (`ParseSqlType` reads `ident . ident` in a "named"-types dialect and looks the type up
  in that schema).
- **Not done**: the label check of a literal in a CASE result (`case when .. then 'bad' else enum_col end`) and
  of enum-typed function arguments other than the four above.
- Cost (`--singleThreaded`): tsconfig.test.json 8.838M -> 9.010M (includes the new test file), stress 10.855M -> 10.884M.

- **Lexer errors from every position (#117).** The monad's token read (`ReadToken`, src/lexer/parser-monad.ts) turns a
  lexer error into an end-of-text token carrying it, so no parser handles it; `ApplyStatements` reports it before any
  parser error. Checked with probes for ORDER BY, GROUP BY, LIMIT, subquery, JOIN ON, CTE, function args, CASE, UPDATE,
  DELETE, ON CONFLICT, RETURNING, INSERT ... SELECT and the three tests `lexer-error-in-*` (WHERE, INSERT VALUES,
  CREATE TABLE DEFAULT): all return 1002. No parser change was needed after batch A; only the tests and the comment.

## #118: empty OVER () and window frames are one shared rule

PostgreSQL accepts `OVER ()` and `ROWS|RANGE|GROUPS` frames exactly like SQLite, so the `windowFrames` dialect fact (SQLT-51) is removed and `CloseWindowOrError` (parse-function-call.ts) accepts them in every dialect. PGT-3 Check now runs through the typed `query`.

## #138: PostgreSQL starts with `public` (SCHEMA-27, SCHEMA-28)

The dialect row field `defaultSchemaExists` (boolean) became `initialSchemas` ("public" | "main"): the schemas a new chain starts with. PostgreSQL's initial database is `{ defaultSchema: DS, schemas: { public } }` also when `defaultSchema` names another schema (that one is still created by a migration, SCHEMA-3). `create schema public;` needed no new code: the existing "schema already exists" error (3200) applies, and `if not exists` is the existing no-op. No new error code.

## 2026-11-19 A bound parameter is a peer; CORE-7 for `:a = :b` waits (#145, track A; CORE-6, CORE-7)

`PeerOperandType` no longer skips parameter operands: one that resolves to a real type (bound in an earlier round) is a peer, so `c0 = :p0 and :p0 = :p1` types `:p1`. The CORE-7 error for operands that are all untyped parameters is now `ParamUnresolved` (CORE-7 plus a marker); `CollectParamProbes` lets a probe found next to it win, so `:p0 = :p1 and c0 = :p0` works too. The retry loop turns a surviving marker into the plain CORE-7 error. No new error code.
