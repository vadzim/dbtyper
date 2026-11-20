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
import type {
	SqliteFunctions,
	SqliteOperators,
	SqlitePgOnlyFunctions,
	SqliteTableFunctions,
} from "../parser/sqlite-functions.ts"
import type { PostgresSkippedForms, SqliteSkippedForms } from "../parser/statement-keywords.ts"
import type { PostgresTypeNameWords } from "./dialect-types.ts"

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

/** PostgreSQL's numeric types, widest first (PGT-35: `integer + bigint` is `bigint`, `integer * numeric` is `numeric`). */
type PostgresNumericOrder = readonly ["double precision", "real", "numeric", "bigint", "integer", "smallint"]

/** SQLT-35: with any REAL operand the result is REAL, else a NUMERIC operand makes it NUMERIC, else it is an integer. */
type SqliteNumericOrder = readonly ["real", "numeric", "integer", "bigint"]

/** The function data of a dialect (the `functionCatalog` fact of {@link Dialects}). */
export type FunctionCatalogFacts = {
	rows: object
	tables: object
	hints: object
	anyType: string
	unlikeTypes: "first" | "any"
	sum: { else: string }
	numericOrder: readonly string[]
}

/** Words that start a skipped statement of PostgreSQL only (STMT-18); in a SQLite chain they are the 1900 error (DSEL-7). */
type PostgresOnlyStatementKeywords = readonly [
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

/** The engines dbtyper types SQL for (DSEL-1). */
export type DialectName = keyof Dialects

/**
 * One row per dialect. `title` is how messages name the engine; `onlyError` is the error raised when SQL of a chain
 * of ANOTHER dialect uses a construct that only this dialect has (DSEL-7: own codes, distinct from syntax errors);
 * `initialSchemas`: the schemas a new chain starts with: "public" = PostgreSQL's `public` (SCHEMA-27; a `defaultSchema`
 * other than `public` must still be created, SCHEMA-3), "main" = SQLite's `main` (the default) and `temp` (no CREATE SCHEMA,
 * SQLT-25).
 * Type facts (SQLT-6…SQLT-17, #67, #180): `declaredTypes` "named" = a declared type name is the type (PostgreSQL), "affinity" =
 * the name only decides an affinity (SQLite, `SqliteTypeKey`): the one rule fact, read only by the type-name rows of
 * dialect-types.ts; `typeNameWords`: which words a type name of several words may go on with (a table of the name so
 * far → the next words, {@link PostgresTypeNameWords}; "any" = every identifier joins, SQLT-6); `userTypes`: CREATE TYPE /
 * DOMAIN names are types and a type name may be schema-qualified (PGT-13, PGT-22); `valueMismatch`: the error for an
 * INSERT / UPDATE value that does not fit its column ("incompatible" = the value type is incompatible, "storage-class" =
 * the column's storage class is named, SQLT-43; a NUMERIC-affinity column takes any value: `comparisonClasses`, SQLT-7);
 * `pkImpliesNotNull`: PRIMARY KEY makes a column
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
 * statement (SQLT-20, SQLT-21); `alterColumn`: "full" = every `ALTER [COLUMN] c` action, "not-null" = only
 * `SET NOT NULL` and `DROP NOT NULL` (SQLite 3.53 and later; any other is the `pg-alter-column` error, #195);
 * `stringColumnNames`: a single-quoted string where a column definition (CREATE TABLE, ADD COLUMN, INSERT column list, SQLT-68) names its column is
 * the name (SQLite's legacy rule, `'order' INTEGER`, #195); `bareNameDefault`: `DEFAULT name` (one unqualified
 * identifier) is the text default 'name' (SQLite, #195; PostgreSQL rejects a column reference there);
 * `defaultConstraintNames`: a constraint written without `CONSTRAINT name` is tracked under the name the engine gives
 * it (PostgreSQL's `<table>_<columns>_key`, `DefaultConstraintName`, #207; SQLite has no named-constraint statements);
 * `dropReferencedColumn`: what dropping a column another table's FOREIGN KEY references does ("cascade" = an error
 * without CASCADE, which drops the constraint, PostgreSQL, #207; "keep" = nothing, SQLite).
 * Function facts (SQLT-44…SQLT-52, #76; #175): `functionCatalog` is the dialect's function data ({@link FunctionCatalogFacts}):
 * `rows` the table of functions (`PostgresFunctions`, `SqliteFunctions`; grammar and resolver helpers in
 * function-catalog.ts), `tables` the columns of each table-valued function (a row of kind "table", a FROM item only:
 * SQLite's `json_each` / `json_tree`, SQLT-69…SQLT-72), `hints` the table of names the OTHER dialect has and this one lacks, with a replacement ("" for
 * none), `anyType` the type name that stands for "any type", `unlikeTypes` what the common type of two unlike,
 * non-numeric types is ("first" = the first one, "any" = `anyType`), `sum` the result of `sum` per argument type
 * (`else` for the types not listed), `numericOrder` the dialect's {@link Dialects} fact of that name.
 * Operator and DML facts (SQLT-30…SQLT-43, #73): `operatorRows`: the operators whose result is not that of the shared
 * expression parser, as function rows over `[left, right]` (`SqliteOperators`: `||`, `->`, `->>`); `globRegexp`: the `GLOB` and `REGEXP`
 * operators exist (`REGEXP` is always error 1917 until users can declare functions, SQLT-34, FN-Q1); `isOperand`: what may follow `IS [NOT]`
 * ("null" = only NULL as in the shared parser, "value" = any value or `DISTINCT FROM`, null-safe, SQLT-33); `limitComma`:
 * `LIMIT offset, count` (SQLT-37); `bareDmlAlias`: the alias of an UPDATE / DELETE target may omit `AS` (SQLite: needs it, error 1309; DML-ALIAS).
 * Query facts (SQLT-28, #101): `groupByRule`: a grouped SELECT may only use grouped columns or aggregates outside
 * aggregates (PostgreSQL; SQLite allows bare columns next to an aggregate); `exprKeys` "name" = an unaliased function
 * call is keyed by its function name (SEL-8), "text" = every unaliased expression is keyed by its source text.
 * Statement facts (PGT-26): `dmlInCte`: `WITH x AS (INSERT | UPDATE | DELETE … RETURNING …)` is a typed CTE (SQLite: an error); `viewIfNotExists`: `CREATE VIEW IF NOT EXISTS` exists (SQLite, SQLT-22; PostgreSQL has it only for `OR REPLACE`);
 * `trackedIndexes`: `CREATE INDEX` / `DROP INDEX` names are kept on their table for `INDEXED BY` (SQLite, SQLT-74; parse-index.ts).
 * `skippedStatements`: the first words of statements stepped over unchecked (STMT-18, STMT-19, #144); `skippedForms`: the
 * second words of `CREATE` / `ALTER` / `DROP` statements stepped over unchecked (the parsed ones are in statement-keywords.ts;
 * any other second word is an error, #158); `otherDialectForms`: the first words and the CREATE / ALTER / DROP second words
 * that only the OTHER dialect (`owner`) has: the other-dialect error (DSEL-7: a wrong engine is not a typo), see
 * {@link OtherDialectFormError}.
 * Number and date facts (#67, #153): `numericOrder`: the numeric types, widest first: arithmetic on two different ones
 * and the common type of function arguments give the one that comes first (PostgreSQL's numeric hierarchy; SQLT-35: REAL,
 * then NUMERIC, then INTEGER); `numberLiterals`: the type of a number literal with a fraction or an exponent (`fraction`),
 * of an integer literal beyond the 32-bit range (`big`; SQLT-35, PGT-35); `booleanType`: the type of TRUE/FALSE, of every comparison result and of a condition (SQLT-9:
 * SQLite has no boolean type, they are integers 0/1); `datetimeArithmetic`: `timestamp ± interval`, `date - date` are typed (PGT-31).
 * `comparisonClasses`: the type names whose comparison class (src/core/comparison-classes.ts) differs in this dialect:
 * SQLite's NUMERIC affinity (STRING, NUMBER, any unknown type name) holds text as well as numbers, so it is the class
 * "affinity", which compares with and is assigned from every class, and is a LIKE operand (#195).
 * `castHint`: the cast spelling the CORE-14 error (3506) suggests for a type without a TypeScript mapping.
 * `positionalParamSign`: how messages spell positional parameter n: the sign before the number (`$1`, `?1`).
 * Lexer facts (#116 item 2), the `lexer` object of a row, read by the lexer through {@link LexerFact} only:
 * `bracketIdents`: `[name]` is a quoted identifier; `atParams`: `@name` and `$name` are named parameters (SQLT-30); `questionParams`: `?` / `?NNN` are positional parameters (SQLT-30; DSEL-4, #196: elsewhere `?` is no parameter even if the driver's `syntax` lists `question-params`, see {@link ParserSyntaxOf});
 * `blobLiterals`: `X'..'` is a blob literal (SQLT-29); `foldQuoted`: quoted names match case-insensitively, so they are
 * lower-cased (SQLT-27); `joinStrings`: adjacent string literals `'a' 'b'` are one string (SQLite: they are not);
 * `keepWritten`: an identifier remembers how it was written, and every token its source text (SQLT-28, result keys);
 * `callableJoinWords`: `left(`/`right(` are function calls, not join keywords (PGT-28); `dollarStrings`: `$$…$$` strings exist; `nestedComments`: a block comment may hold another (PostgreSQL), else it ends at the first close (SQLite)
 * (without a dialect flag, in low-level lexer tests, the PostgreSQL row applies).
 */
export type Dialects = {
	postgres: {
		title: "PostgreSQL"
		onlyError: Errors["POSTGRES_ONLY_SYNTAX"]
		initialSchemas: "public"
		declaredTypes: "named"
		typeNameWords: PostgresTypeNameWords
		userTypes: true
		valueMismatch: "incompatible"
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
		alterColumn: "full"
		stringColumnNames: false
		bareNameDefault: false
		defaultConstraintNames: true
		dropReferencedColumn: "cascade"
		functionCatalog: {
			rows: PostgresFunctions
			tables: {}
			hints: PostgresSqliteOnlyFunctions
			anyType: "unknown"
			unlikeTypes: "first"
			sum: {
				smallint: "bigint"
				integer: "bigint"
				real: "real"
				"double precision": "double precision"
				else: "numeric"
			}
			numericOrder: PostgresNumericOrder
		}
		operatorRows: {}
		globRegexp: false
		numericOrder: PostgresNumericOrder
		numberLiterals: { fraction: "numeric"; big: "bigint" }
		booleanType: "boolean"
		datetimeArithmetic: true
		isOperand: "null"
		limitComma: false
		bareDmlAlias: true
		groupByRule: true
		exprKeys: "name"
		comparisonClasses: {}
		castHint: "`::text`"
		positionalParamSign: "$"
		dmlInCte: true
		viewIfNotExists: false
		trackedIndexes: false
		skippedStatements: readonly [...CommonSkippedStatementKeywords, ...PostgresOnlyStatementKeywords, "end"]
		skippedForms: PostgresSkippedForms
		otherDialectForms: {
			owner: "sqlite"
			statements: "pragma"
			create: never
			alter: never
			drop: never
		}
		lexer: {
			bracketIdents: false
			atParams: false
			questionParams: false
			blobLiterals: false
			foldQuoted: false
			joinStrings: true
			keepWritten: false
			callableJoinWords: true
			dollarStrings: true
			nestedComments: true
		}
	}
	sqlite: {
		title: "SQLite"
		onlyError: Errors["SQLITE_ONLY_SYNTAX"]
		initialSchemas: "main"
		declaredTypes: "affinity"
		typeNameWords: "any"
		userTypes: false
		valueMismatch: "storage-class"
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
		alterColumn: "not-null"
		stringColumnNames: true
		bareNameDefault: true
		defaultConstraintNames: false
		dropReferencedColumn: "keep"
		functionCatalog: {
			rows: SqliteFunctions
			tables: SqliteTableFunctions
			hints: SqlitePgOnlyFunctions
			anyType: "any"
			unlikeTypes: "any"
			sum: { integer: "integer"; bigint: "integer"; else: "real" }
			numericOrder: SqliteNumericOrder
		}
		operatorRows: SqliteOperators
		globRegexp: true
		numericOrder: SqliteNumericOrder
		numberLiterals: { fraction: "real"; big: "integer" }
		booleanType: "integer"
		datetimeArithmetic: false
		isOperand: "value"
		limitComma: true
		bareDmlAlias: false
		groupByRule: false
		exprKeys: "text"
		comparisonClasses: { numeric: "affinity" }
		castHint: "`CAST(x AS TEXT)`"
		positionalParamSign: "?"
		dmlInCte: false
		viewIfNotExists: true
		trackedIndexes: true
		skippedStatements: readonly [...CommonSkippedStatementKeywords, "pragma", "end"]
		skippedForms: SqliteSkippedForms
		otherDialectForms: {
			owner: "postgres"
			statements: PostgresOnlyStatementKeywords[number]
			create: Exclude<PostgresSkippedForms["create"][number], SqliteSkippedForms["create"][number]>
			alter: PostgresSkippedForms["alter"][number]
			drop: Exclude<PostgresSkippedForms["drop"][number], SqliteSkippedForms["drop"][number]>
		}
		lexer: {
			bracketIdents: true
			atParams: true
			questionParams: true
			blobLiterals: true
			foldQuoted: true
			joinStrings: false
			keepWritten: true
			callableJoinWords: false
			dollarStrings: false
			nestedComments: false
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
	| Exclude<
			Config["syntax"],
			Dialects[Config["dialect"]]["lexer"]["questionParams"] extends true ? never : "question-params"
	  >
	| DialectFlag<Config["dialect"]>
	| (Config extends { singleStatement: true } ? SingleStatementFlag : never)

/** The dialect(s) `Syntax` names: one name, a union of both, or `never` for none. */
type SyntaxDialect<Syntax extends string> =
	Extract<Syntax, DialectFlags> extends `dialect:${infer D extends DialectName}` ? D : never

/** One fact of the dialect a `Syntax` names (the default dialect's when it names none or several). */
export type SyntaxDialectFact<Syntax extends string, Fact extends keyof Dialects[DialectName]> = Dialects[IsSingle<
	SyntaxDialect<Syntax>
> extends true
	? SyntaxDialect<Syntax>
	: DefaultDialect][Fact]

/**
 * The `comparisonClasses` fact of a database state's dialect (see {@link Dialects}); `{}` for no state (`never`), so a
 * caller without a database compares by the shared table.
 */
export type ComparisonClassesOf<Db> = [Db] extends [never] ? {} : DialectFact<Db, "comparisonClasses">

/** The dialect of a database state; the default dialect when the state names none (see {@link DialectFact}). */
type DialectOf<Db> = Db extends { dialect: infer D extends DialectName } ? D : DefaultDialect

/**
 * One fact of the dialect row (see {@link Dialects}) of a database state: the state of a chain carries its dialect
 * (`dialect` of {@link JsqlDatabaseShape}), which every parser already receives; the parser monad's own state is
 * not readable by parsers (monad checker). A state without one (PostgreSQL chains, dialect-neutral low-level
 * parsing) answers with the PostgreSQL row, which is what the parser did before dialects.
 */
export type DialectFact<Db, Fact extends keyof Dialects[DialectName]> = Dialects[DialectOf<Db>][Fact]

/**
 * DSEL-7: the other-dialect error for a statement form (`CREATE SEQUENCE` in a SQLite chain, `PRAGMA` in a PostgreSQL
 * one) that only the dialect `owner` of the row `otherDialectForms` has; `Phrase` names the form.
 */
export type OtherDialectFormError<Db, Phrase extends string> = FormatErrorOf<
	Dialects[DialectFact<Db, "otherDialectForms">["owner"]]["onlyError"],
	[Phrase, DialectFact<Db, "title">, ""]
>

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

/** How messages name the other engine(s) of a chain: every dialect but the state's own (SQLT-52, PGT-34). */
export type OtherDialectTitle<Db> = Dialects[Exclude<DialectName, DialectOf<Db>>]["title"]
