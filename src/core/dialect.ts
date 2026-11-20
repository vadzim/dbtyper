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
import type { DialectConstruct, DialectOnlyConstructs } from "./dialect-constructs.ts"
import type { PostgresFunctions, PostgresSqliteOnlyFunctions } from "../parser/postgres-functions.ts"
import type { SqliteFunctions, SqlitePgOnlyFunctions } from "../parser/sqlite-functions.ts"
import type { PostgresSkippedForms, SqliteSkippedForms } from "../parser/statement-keywords.ts"

/** Words that start a skipped statement of both dialects (STMT-18; second words of CREATE/ALTER/DROP: `skippedForms`). */
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
 * Function facts (SQLT-44…SQLT-52, #76): `functionCatalog` "typed" (PostgreSQL) = result types computed from the argument types, "affinity" (SQLite) = storage-class results; `functionRows` is the dialect's data table (`PostgresFunctions`, `SqliteFunctions`; grammar and resolver helpers in function-catalog.ts) and `functionHints` the table of names the OTHER dialect has and this one lacks, with a replacement ("" for none).
 * Operator and DML facts (SQLT-30…SQLT-43, #73): `operators` "typed" = the PostgreSQL operator typing of the
 * expression parser, "affinity" = `||`, `->`, `->>` from the data table `SqliteOperators` (same file); `globRegexp`: the `GLOB` and `REGEXP`
 * operators exist (`REGEXP` is always error 1917 until users can declare functions, SQLT-34, FN-Q1); `isOperand`: what may follow `IS [NOT]`
 * ("null" = only NULL as in the shared parser, "value" = any value or `DISTINCT FROM`, null-safe, SQLT-33); `limitComma`:
 * `LIMIT offset, count` (SQLT-37); `bareDmlAlias`: the alias of an UPDATE / DELETE target may omit `AS` (SQLite: needs it, error 1309; DML-ALIAS).
 * Query facts (SQLT-28, #101): `groupByRule`: a grouped SELECT may only use grouped columns or aggregates outside
 * aggregates (PostgreSQL; SQLite allows bare columns next to an aggregate); `exprKeys` "name" = an unaliased function
 * call is keyed by its function name (SEL-8), "text" = every unaliased expression is keyed by its source text.
 * Statement facts (PGT-26): `dmlInCte`: `WITH x AS (INSERT | UPDATE | DELETE … RETURNING …)` is a typed CTE (SQLite: an error); `viewIfNotExists`: `CREATE VIEW IF NOT EXISTS` exists (SQLite, SQLT-22; PostgreSQL has it only for `OR REPLACE`).
 * `skippedStatements`: the first words of statements stepped over unchecked (STMT-18, STMT-19, #144); `skippedForms`: the
 * second words of `CREATE` / `ALTER` / `DROP` statements stepped over unchecked (the parsed ones are in statement-keywords.ts;
 * any other second word is an error, #158).
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
		functionRows: PostgresFunctions
		functionHints: PostgresSqliteOnlyFunctions
		operators: "typed"
		globRegexp: false
		numberTyping: "uniform"
		datetimeArithmetic: true
		isOperand: "null"
		limitComma: false
		bareDmlAlias: true
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
		skippedForms: PostgresSkippedForms
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
		functionRows: SqliteFunctions
		functionHints: SqlitePgOnlyFunctions
		operators: "affinity"
		globRegexp: true
		numberTyping: "affinity"
		datetimeArithmetic: false
		isOperand: "value"
		limitComma: true
		bareDmlAlias: false
		groupByRule: false
		exprKeys: "text"
		castHint: "`CAST(x AS TEXT)`"
		dmlInCte: false
		viewIfNotExists: true
		skippedStatements: readonly [...CommonSkippedStatementKeywords, "pragma", "end"]
		skippedForms: SqliteSkippedForms
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
/** `single-statement`: the driver runs only the first statement of a text, so a second statement is an error (STMT-Q5, #156). */
export type SingleStatementFlag = "single-statement"
export type ParserSyntax = LexerFeatures | DialectFlags | SingleStatementFlag

/** The parser syntax of a driver config: its lexer features plus its dialect flag (DSEL-1, DSEL-3). */
export type ParserSyntaxOf<
	Config extends { syntax: LexerFeatures; dialect: DialectName; singleStatement?: true | undefined },
> =
	| Config["syntax"]
	| DialectFlag<Config["dialect"]>
	| (Config extends { singleStatement: true } ? SingleStatementFlag : never)

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

/** The dialect whose `functionCatalog` fact is `C`; the default dialect for any other value. */
type CatalogDialect<C extends string> = [
	{ [D in DialectName]: Dialects[D]["functionCatalog"] extends C ? D : never }[DialectName],
] extends [infer D extends DialectName]
	? [D] extends [never]
		? DefaultDialect
		: D
	: never

/** The function table (`functionRows`) of the dialect whose `functionCatalog` fact is `C`. */
export type FunctionRowsOf<C extends string> = Dialects[CatalogDialect<C>]["functionRows"]

/** The hint table (`functionHints`) of the dialect whose `functionCatalog` fact is `C`. */
export type FunctionHintsOf<C extends string> = Dialects[CatalogDialect<C>]["functionHints"]
