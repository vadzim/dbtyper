/**
 * Dialect seam: which SQL engine a migration chain speaks, and which syntax belongs to one engine only.
 * Spec DSEL-1, DSEL-3, DSEL-5, DSEL-6, DSEL-7, DSEL-11; #51 (track A).
 *
 * Decision (#51, also in DECISIONS.md):
 * - The dialect is a field of the driver's type-level config (`DriverConfig["dialect"]`), never a separate setting
 *   (DSEL-1, DSEL-8). It reaches the type-level parser as one extra flag in the lexer's `Syntax` string union
 *   (`dialect:postgres` / `dialect:sqlite`, see {@link ParserSyntaxOf}), so no parser signature changes: every parser
 *   already carries `Syntax` inside the parser monad.
 * - Dialect facts are DATA in this module, not conditions spread over parser files. A construct that exists in one
 *   engine only is one row of {@link DialectOnlyConstructs}; a dialect is one row of {@link Dialects}. Later issues
 *   (SQLT-53 list, SQLite type names, PostgreSQL catalogs) add rows here, and ask {@link DialectOnlyError}
 *   "is construct X allowed under this Syntax?" where the construct is recognised.
 * - The check runs in the token stream, not in the parsers: the lexer tags one-token constructs (`$1`, `$$…$$`,
 *   backticks), the parser monad matches keyword phrases of {@link DialectPhrases} (`::`, `INSERT OR …`) when it
 *   reads their first word. The first other-dialect error is recorded in the monad, the token is still read
 *   normally (parsing goes on, so the error is not lost in parser recovery, STMT-Q3), and the end-of-text token
 *   carries the error to `ApplyStatements`, which reports it before any parser error: it is the root cause.
 *   No parser file needs a dialect condition for this, and later rows cost nothing to the parsers.
 *   A construct that only context can recognise (a type name, `DISTINCT ON`) is checked by its parser with
 *   {@link DialectOnlyError} on `Syntax` and returns the error directly.
 * - Dialect files only add or remove (DSEL-11): a construct is either accepted with the shared meaning or rejected
 *   with an other-dialect error; there is no per-dialect reinterpretation here.
 * - Without a dialect flag (low-level parser tests that call `CreateParserMonad`/`ApplyStatements` directly), or with
 *   both flags, nothing is gated: that is dialect-neutral parsing, never reachable through `sqlMigrations`, which
 *   requires a driver with exactly one declared dialect.
 */
import type { Errors, FormatErrorOf } from "../dbtyper-error.ts"
import type { LexerFeatures } from "../lexer/sql-lexer.ts"

/** Words that start a skipped statement of both dialects (STMT-18; the second word of CREATE/ALTER/DROP is not checked). */
type CommonSkippedStatementKeywords = readonly [
	"grant",
	"revoke",
	"truncate",
	"set",
	"reset",
	"show",
	"vacuum",
	"analyze",
	"explain",
	"begin",
	"commit",
	"rollback",
	"savepoint",
	"release",
	"reindex",
	"values",
]

/** The engines dbtyper types SQL for (DSEL-1). */
export type DialectName = keyof Dialects

/**
 * One row per dialect. `title` is how messages name the engine; `onlyError` is the error raised when SQL of a chain
 * of ANOTHER dialect uses a construct that only this dialect has (DSEL-7: own codes, distinct from syntax errors);
 * `initialSchemas`: the schemas a new chain starts with: "public" = PostgreSQL's `public` (SCHEMA-27; a `defaultSchema`
 * other than `public` must still be created, SCHEMA-3), "main" = SQLite's `main` (the default) and `temp` (no CREATE SCHEMA,
 * SQLT-25).
 * Type facts (SQLT-6…SQLT-17, #67): `declaredTypes` "named" = a declared type name is the type (PostgreSQL), "affinity" =
 * the name only decides an affinity (SQLite, {@link SqliteTypeKey}); `pkImpliesNotNull`: PRIMARY KEY makes a column
 * NOT NULL (CORE-1; SQLite: only for INTEGER PRIMARY KEY, STRICT and WITHOUT ROWID tables, SQLT-14);
 * `rowidTables`: tables have the `rowid` pseudo-columns (SQLT-15); `typelessColumns`: a column may have no type (SQLT-10).
 * DDL facts, one per rule (SQLT-18…SQLT-26, #70; DLCT-4): `tempObjects`: the `temp` schema is searched first for an unqualified
 * name and `CREATE TEMP`, `CREATE TRIGGER … BEGIN … END` exist (SQLT-23, SQLT-25); `schemaStatements`: `CREATE`/`DROP SCHEMA`
 * exist (SQLT-26); `unsupportedStatements`: first words of statements that are always an error (ATTACH, DETACH, SQLT-24);
 * `constraintOnConflict`: `ON CONFLICT <action>` may follow a column or table constraint, `ASC`/`DESC` a primary key
 * (SQLT-18); `shortGenerated`: the short `AS (…)` generated column (SQLT-18); `currentDatetimeType`: type of
 * `CURRENT_DATE`/`CURRENT_TIME`/`CURRENT_TIMESTAMP` in a DEFAULT ("typed" = date/time/timestamp, "any" = any column may
 * default to them, SQLT-19); `addColumn`: "full" = `ADD COLUMN` takes the full column definition and a `, <action>` may
 * follow, "restricted" = PRIMARY KEY, UNIQUE and NOT NULL without a default are errors and the definition ends the
 * statement (SQLT-20, SQLT-21).
 * Function facts (SQLT-44…SQLT-52, #76): `functionCatalog` "typed" (PostgreSQL) = the data table `PostgresFunctions` (src/parser/postgres-functions.ts; grammar and resolver helpers in function-catalog.ts) (the array functions are rows too), "affinity" (SQLite) = the data table `SqliteFunctions` (src/parser/sqlite-functions.ts).
 * Operator and DML facts (SQLT-30…SQLT-43, #73): `operators` "typed" = the PostgreSQL operator typing of the
 * expression parser, "affinity" = `||`, `->`, `->>` from the data table `SqliteOperators` (same file); `globRegexp`: the `GLOB` and `REGEXP`
 * operators exist (`REGEXP` is always error 1917 until users can declare functions, SQLT-34, FN-Q1); `isOperand`: what may follow `IS [NOT]`
 * ("null" = only NULL as in the shared parser, "value" = any value or `DISTINCT FROM`, null-safe, SQLT-33); `limitComma`:
 * `LIMIT offset, count` (SQLT-37).
 * Query facts (SQLT-28, #101): `groupByRule`: a grouped SELECT may only use grouped columns or aggregates outside
 * aggregates (PostgreSQL; SQLite allows bare columns next to an aggregate); `exprKeys` "name" = an unaliased function
 * call is keyed by its function name (SEL-8), "text" = every unaliased expression is keyed by its source text.
 * Statement facts (PGT-26): `dmlInCte`: `WITH x AS (INSERT | UPDATE | DELETE … RETURNING …)` is a typed CTE (SQLite: an error); `viewIfNotExists`: `CREATE VIEW IF NOT EXISTS` exists (SQLite, SQLT-22; PostgreSQL has it only for `OR REPLACE`).
 * `skippedStatements`: the first words of statements stepped over unchecked (STMT-18, STMT-19, #144).
 * Number and date facts (#67): `numberTyping` "uniform" = each numeric type keeps its own type in arithmetic, "affinity" = SQLite's
 * integer/real rules; `datetimeArithmetic`: `timestamp ± interval`, `date - date` are typed (PGT-31).
 * `castHint`: the cast spelling the CORE-14 error (3506) suggests for a type without a TypeScript mapping.
 * Lexer facts (#116 item 2), the `lexer` object of a row, read by the lexer through {@link LexerFact} only:
 * `bracketIdents`: `[name]` is a quoted identifier; `atParams`: `@name` and `$name` are named parameters (SQLT-30);
 * `blobLiterals`: `X'..'` is a blob literal (SQLT-29); `foldQuoted`: quoted names match case-insensitively, so they are
 * lower-cased (SQLT-27); `joinStrings`: adjacent string literals `'a' 'b'` are one string (SQLite: they are not);
 * `keepWritten`: an identifier remembers how it was written, and every token its source text (SQLT-28, result keys);
 * `callableJoinWords`: `left(`/`right(` are function calls, not join keywords (PGT-28); `dollarStrings`: `$$…$$` strings exist
 * (without a dialect flag, in low-level lexer tests, the PostgreSQL row applies).
 */
export type Dialects = {
	postgres: {
		title: "PostgreSQL"
		onlyError: Errors["POSTGRES_ONLY_SYNTAX"]
		initialSchemas: "public"
		declaredTypes: "named"
		pkImpliesNotNull: true
		rowidTables: false
		typelessColumns: false
		tempObjects: false
		schemaStatements: true
		unsupportedStatements: readonly []
		constraintOnConflict: false
		shortGenerated: false
		currentDatetimeType: "typed"
		addColumn: "full"
		functionCatalog: "typed"
		operators: "typed"
		globRegexp: false
		numberTyping: "uniform"
		datetimeArithmetic: true
		isOperand: "null"
		limitComma: false
		groupByRule: true
		exprKeys: "name"
		castHint: "`::text`"
		dmlInCte: true
		viewIfNotExists: false
		skippedStatements: readonly [
			...CommonSkippedStatementKeywords,
			"comment",
			"copy",
			"lock",
			"do",
			"call",
			"cluster",
			"refresh",
			"notify",
			"listen",
			"unlisten",
			"table",
			"start",
			"end",
			"abort",
			"prepare",
			"execute",
			"deallocate",
			"declare",
			"fetch",
			"move",
			"close",
			"discard",
			"merge",
			"load",
			"checkpoint",
			"security",
			"import",
		]
		lexer: {
			bracketIdents: false
			atParams: false
			blobLiterals: false
			foldQuoted: false
			joinStrings: true
			keepWritten: false
			callableJoinWords: true
			dollarStrings: true
		}
	}
	sqlite: {
		title: "SQLite"
		onlyError: Errors["SQLITE_ONLY_SYNTAX"]
		initialSchemas: "main"
		declaredTypes: "affinity"
		pkImpliesNotNull: false
		rowidTables: true
		typelessColumns: true
		tempObjects: true
		schemaStatements: false
		unsupportedStatements: readonly ["attach", "detach"]
		constraintOnConflict: true
		shortGenerated: true
		currentDatetimeType: "any"
		addColumn: "restricted"
		functionCatalog: "affinity"
		operators: "affinity"
		globRegexp: true
		numberTyping: "affinity"
		datetimeArithmetic: false
		isOperand: "value"
		limitComma: true
		groupByRule: false
		exprKeys: "text"
		castHint: "`CAST(x AS TEXT)`"
		dmlInCte: false
		viewIfNotExists: true
		skippedStatements: readonly [...CommonSkippedStatementKeywords, "pragma", "end"]
		lexer: {
			bracketIdents: true
			atParams: true
			blobLiterals: true
			foldQuoted: true
			joinStrings: false
			keepWritten: true
			callableJoinWords: false
			dollarStrings: false
		}
	}
}

/** The dialect a chain without a dialect flag or a state without one is read as: what the parser did before dialects. */
type DefaultDialect = "postgres"

/** The `Syntax` flag that names a chain's dialect. */
type DialectFlag<D extends DialectName> = `dialect:${D}`

type DialectFlags = DialectFlag<DialectName>

/** The dialect a lexer `Syntax` names; without a dialect flag (low-level tests) the lexer reads PostgreSQL. */
type LexerDialectOf<Syntax extends string> = [Extract<Syntax, DialectFlags>] extends [never]
	? DefaultDialect
	: Extract<Syntax, DialectFlags> extends DialectFlag<infer D>
		? D
		: never

/** One lexer fact (see {@link Dialects}) of the dialect named by `Syntax`. The only place the lexer reads a dialect. */
export type LexerFact<
	Syntax extends string,
	K extends keyof Dialects["postgres"]["lexer"],
> = Dialects[LexerDialectOf<Syntax>]["lexer"][K]

/** `Syntax` without the flags of the dialects whose lexer fact `K` is true (to read a text as another dialect would). */
export type SyntaxWithoutLexerFact<Syntax extends string, K extends keyof Dialects["postgres"]["lexer"]> = Exclude<
	Syntax,
	DialectFlag<{ [D in DialectName]: Dialects[D]["lexer"][K] extends true ? D : never }[DialectName]>
>

/** Everything the lexer/parser `Syntax` union may hold: driver lexer features plus the dialect flag. */
export type ParserSyntax = LexerFeatures | DialectFlags

/** The parser syntax of a driver config: its lexer features plus its dialect flag (DSEL-1, DSEL-3). */
export type ParserSyntaxOf<Config extends { syntax: LexerFeatures; dialect: DialectName }> =
	Config["syntax"] | DialectFlag<Config["dialect"]>

/**
 * Constructs that exist in one engine only (DSEL-5, DSEL-6). `name` is how the message names the construct, `hint`
 * the suggested replacement in the chain's own dialect ("" for none); `<next>` in a hint is replaced by the next
 * word of the SQL, upper-cased (`id::text` → `Use CAST(x AS TEXT)`).
 * The full PostgreSQL-only list is SQLT-53; rows are added by the issues that own them.
 */
type DialectOnlyConstructs = {
	"pg-cast": { only: "postgres"; name: "`::` cast"; hint: "Use CAST(x AS <next>)" }
	"pg-positional-param": { only: "postgres"; name: "`$n` positional parameter"; hint: "Use ? or ?NNN" }
	"pg-dollar-string": { only: "postgres"; name: "Dollar-quoted string"; hint: "Use a single-quoted string" }
	"sqlite-backtick-ident": {
		only: "sqlite"
		name: "Backtick-quoted identifier"
		hint: 'Use a double-quoted identifier ("name")'
	}
	"sqlite-insert-or-replace": { only: "sqlite"; name: "INSERT OR REPLACE"; hint: "Use ON CONFLICT … DO UPDATE" }
	"sqlite-insert-or-ignore": { only: "sqlite"; name: "INSERT OR IGNORE"; hint: "Use ON CONFLICT DO NOTHING" }
	"sqlite-insert-or": { only: "sqlite"; name: "INSERT OR <conflict action>"; hint: "Use ON CONFLICT" }
	"sqlite-replace-into": { only: "sqlite"; name: "REPLACE INTO"; hint: "Use INSERT … ON CONFLICT … DO UPDATE" }
	"pg-serial": { only: "postgres"; name: "SERIAL type"; hint: "Use INTEGER PRIMARY KEY" }
	"pg-alter-column": {
		only: "postgres"
		name: "ALTER COLUMN"
		hint: "Rebuild the table (create, copy, drop, rename)"
	}
	"pg-add-constraint": { only: "postgres"; name: "ADD CONSTRAINT"; hint: "Declare it in CREATE TABLE" }
	// SQLT-53 (#76)
	"pg-array-ctor": { only: "postgres"; name: "`ARRAY[…]`"; hint: "Use json_array(…)" }
	"pg-array-type": { only: "postgres"; name: "Array type `T[]`"; hint: "Use a JSON TEXT column" }
	"pg-any-all-some": {
		only: "postgres"
		name: "`ANY`/`ALL`/`SOME` comparison"
		hint: "Use IN (…) or a subquery with EXISTS"
	}
	"pg-ilike": { only: "postgres"; name: "ILIKE"; hint: "In SQLite LIKE is already case-insensitive" }
	"pg-distinct-on": { only: "postgres"; name: "DISTINCT ON"; hint: "Use a window function or GROUP BY" }
	"pg-array-contains": { only: "postgres"; name: "`@>` operator"; hint: "Use json_each(…)" }
	"pg-array-contained": { only: "postgres"; name: "`<@` operator"; hint: "Use json_each(…)" }
	"pg-array-overlap": { only: "postgres"; name: "`&&` operator"; hint: "Use json_each(…)" }
	"pg-similar-to": { only: "postgres"; name: "SIMILAR TO"; hint: "Use LIKE or GLOB" }
	"pg-json-path": { only: "postgres"; name: "`#>` / `#>>` operators"; hint: "Use json_extract(x, path)" }
	"pg-limit-all": { only: "postgres"; name: "LIMIT ALL"; hint: "Omit LIMIT" }
	"pg-lateral": { only: "postgres"; name: "LATERAL"; hint: "Use a correlated subquery" }
	"pg-create-type": { only: "postgres"; name: "CREATE TYPE"; hint: "Use TEXT with a CHECK constraint" }
	"pg-drop-type": { only: "postgres"; name: "DROP TYPE"; hint: "" }
	"pg-create-schema": { only: "postgres"; name: "CREATE SCHEMA"; hint: "SQLite has no schemas" }
	"pg-create-extension": { only: "postgres"; name: "CREATE EXTENSION"; hint: "" }
	"pg-grant": { only: "postgres"; name: "GRANT"; hint: "SQLite has no users or privileges" }
	"pg-on-conflict-constraint": {
		only: "postgres"
		name: "ON CONFLICT ON CONSTRAINT"
		hint: "Use ON CONFLICT (columns)"
	}
	"pg-delete-using": { only: "postgres"; name: "DELETE … USING"; hint: "Use a subquery" }
	"pg-fetch-first": { only: "postgres"; name: "FETCH FIRST"; hint: "Use LIMIT" }
	"pg-type-timestamptz": {
		only: "postgres"
		name: "`timestamptz` type"
		hint: "Use TEXT (ISO 8601) or INTEGER (unix time)"
	}
	"pg-type-jsonb": { only: "postgres"; name: "`jsonb` type"; hint: "Use TEXT or JSON" }
	"pg-type-uuid": { only: "postgres"; name: "`uuid` type"; hint: "Use TEXT" }
	"pg-type-bytea": { only: "postgres"; name: "`bytea` type"; hint: "Use BLOB" }
}

/** SQLT-53: PostgreSQL-only type names and the construct row each one gives (lower-case, words joined by one space). */
export type PgOnlyTypeNames = {
	timestamptz: "pg-type-timestamptz"
	"timestamp with time zone": "pg-type-timestamptz"
	"time with time zone": "pg-type-timestamptz"
	timetz: "pg-type-timestamptz"
	jsonb: "pg-type-jsonb"
	uuid: "pg-type-uuid"
	bytea: "pg-type-bytea"
}

export type DialectConstruct = keyof DialectOnlyConstructs

/**
 * Keyword phrases (1–3 lower-case words) that are a one-dialect construct, checked by the parser monad when it reads
 * the phrase's first token; the longest phrase wins. `<next>` in a hint is the word after the phrase.
 */
type DialectPhrases = {
	"::": "pg-cast"
	"insert or replace": "sqlite-insert-or-replace"
	"insert or ignore": "sqlite-insert-or-ignore"
	"insert or": "sqlite-insert-or"
	"replace into": "sqlite-replace-into"
	"alter column": "pg-alter-column"
	"add constraint": "pg-add-constraint"
	"add primary key": "pg-add-constraint"
	"add unique": "pg-add-constraint"
	"add foreign key": "pg-add-constraint"
	"add check": "pg-add-constraint"
	// SQLT-53 (#76). Constructs that need parser context (`ANY`, `DISTINCT ON`, `DELETE … USING`, type names) are checked by their parsers.
	"array [": "pg-array-ctor"
	"[ ]": "pg-array-type"
	ilike: "pg-ilike"
	"@>": "pg-array-contains"
	"<@": "pg-array-contained"
	"&&": "pg-array-overlap"
	"similar to": "pg-similar-to"
	"limit all": "pg-limit-all"
	"#>": "pg-json-path"
	"#>>": "pg-json-path"
	lateral: "pg-lateral"
	"create type": "pg-create-type"
	"create schema": "pg-create-schema"
	"drop type": "pg-drop-type"
	"create extension": "pg-create-extension"
	grant: "pg-grant"
	"conflict on constraint": "pg-on-conflict-constraint"
	"fetch first": "pg-fetch-first"
	"fetch next": "pg-fetch-first"
}

type PhraseHead<P> = P extends `${infer Head} ${string}` ? Head : P

/** First words of {@link DialectPhrases}: only these tokens pay for the lookahead. */
export type DialectPhraseHeads = PhraseHead<keyof DialectPhrases>

/** `[construct, number of words]` of the longest phrase `W1 W2 W3` starts with, or `never`. */
export type MatchDialectPhrase<
	W1 extends string,
	W2 extends string,
	W3 extends string,
> = `${W1} ${W2} ${W3}` extends infer P3 extends keyof DialectPhrases
	? [DialectPhrases[P3], 3]
	: `${W1} ${W2}` extends infer P2 extends keyof DialectPhrases
		? [DialectPhrases[P2], 2]
		: W1 extends keyof DialectPhrases
			? [DialectPhrases[W1], 1]
			: never

/** The dialect(s) `Syntax` names: one name, a union of both, or `never` for none. */
type SyntaxDialect<Syntax extends string> =
	Extract<Syntax, DialectFlags> extends `dialect:${infer D extends DialectName}` ? D : never

/**
 * DLCT-4: how messages name the dialect(s) whose `functionCatalog` fact differs from `Catalog`, i.e. "the other engine"
 * of a chain whose catalog is `Catalog`.
 */
export type OtherDialectTitleOf<Catalog extends string> = {
	[D in DialectName]: Dialects[D]["functionCatalog"] extends Catalog ? never : Dialects[D]["title"]
}[DialectName]

/** The dialect of a database state; the default dialect when the state names none (see {@link DialectFact}). */
type DialectOf<Db> = Db extends { dialect: infer D extends DialectName } ? D : DefaultDialect

/**
 * One fact of the dialect row (see {@link Dialects}) of a database state: the state of a chain carries its dialect
 * (`dialect` of {@link JsqlDatabaseShape}), which every parser already receives; the parser monad's own state is
 * not readable by parsers (monad checker). A state without one (PostgreSQL chains, dialect-neutral low-level
 * parsing) answers with the PostgreSQL row, which is what the parser did before dialects.
 */
export type DialectFact<Db, Fact extends keyof Dialects[DialectName]> = Dialects[DialectOf<Db>][Fact]

/** `true` for exactly one member, `false` for `never` or a union. */
export type IsSingle<U, All = U> = [U] extends [never]
	? false
	: U extends unknown
		? [All] extends [U]
			? true
			: false
		: never

/**
 * `null` when `Construct` may be used under `Syntax`, otherwise the other-dialect error (DSEL-5, DSEL-6, DSEL-7).
 * `NextWord` fills `<next>` in the hint.
 */
export type DialectOnlyError<Syntax extends string, Construct extends DialectConstruct, NextWord extends string = ""> =
	SyntaxDialect<Syntax> extends infer Current extends DialectName
		? IsSingle<Current> extends true
			? DialectOnlyConstructs[Construct] extends {
					only: infer Owner extends DialectName
					name: infer Name extends string
					hint: infer Hint extends string
				}
				? Owner extends Current
					? null
					: Dialects[Owner]["onlyError"] extends infer OnlyError extends OtherDialectErrors
						? FormatErrorOf<OnlyError, [Name, Dialects[Current]["title"], FormatHint<Hint, NextWord>]>
						: null
				: null
			: null
		: null

/**
 * {@link DialectOnlyError} for a parser that has the database state, not `Syntax`: the chain's dialect is the state's
 * (see {@link DialectOf}).
 */
export type DbDialectOnlyError<Db, Construct extends DialectConstruct, NextWord extends string = ""> = DialectOnlyError<
	DialectFlag<DialectOf<Db>>,
	Construct,
	NextWord
>

/** All other-dialect error descriptions; they share one message shape: construct, this chain's dialect, hint. */
type OtherDialectErrors = Dialects[DialectName]["onlyError"]

type FormatHint<Hint extends string, NextWord extends string> = Hint extends ""
	? ""
	: Hint extends `${infer Before}<next>${infer After}`
		? `. ${Before}${NextWord extends "" ? "type" : Uppercase<NextWord>}${After}`
		: `. ${Hint}`
