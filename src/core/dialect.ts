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
import type { DbtyperErrorShape, Errors, FormatErrorOf } from "../dbtyper-error.ts"
import type { LexerFeatures } from "../lexer/sql-lexer.ts"

/** The engines dbtyper types SQL for (DSEL-1). */
export type DialectName = keyof Dialects

/**
 * One row per dialect. `title` is how messages name the engine; `onlyError` is the error raised when SQL of a chain
 * of ANOTHER dialect uses a construct that only this dialect has (DSEL-7: own codes, distinct from syntax errors);
 * `defaultSchemaExists`: a new chain starts with its default schema already there (SQLite has no CREATE SCHEMA,
 * SQLT-25; the `main`/`temp` naming is the SQLite names issue's), or must create it first (PostgreSQL, SCHEMA-4).
 * Type facts (SQLT-6…SQLT-17, #67): `typeNames` "named" = a declared type name is the type (PostgreSQL), "affinity" =
 * the name only decides an affinity (SQLite, {@link SqliteTypeKey}); `pkImpliesNotNull`: PRIMARY KEY makes a column
 * NOT NULL (CORE-1; SQLite: only for INTEGER PRIMARY KEY, STRICT and WITHOUT ROWID tables, SQLT-14);
 * `rowidTables`: tables have the `rowid` pseudo-columns (SQLT-15); `typelessColumns`: a column may have no type (SQLT-10).
 * SQLite DDL facts (SQLT-18…SQLT-26, #70), one flag: `ddl`: `main`/`temp` instead of schemas, CREATE TEMP, short `AS (…)`
 * generated columns, `ON CONFLICT` on constraints, full column definitions in ADD COLUMN with its restrictions, trigger
 * bodies `BEGIN … END`, no CREATE/DROP SCHEMA, no ATTACH / virtual tables.
 * Function facts (SQLT-44…SQLT-52, #76): `functionCatalog` "postgres" = the data table `PostgresFunctions` (src/parser/postgres-functions.ts) plus the array functions of the expression
 * parser and the chain's own `functions`, "sqlite" = the data table `SqliteFunctions` (src/parser/sqlite-functions.ts).
 * Operator and DML facts (SQLT-30…SQLT-43, #73): `operators` "builtin" = the PostgreSQL operator typing of the
 * expression parser, "sqlite" = `||`, `->`, `->>` from the data table `SqliteOperators` (same file); `globRegexp`: the `GLOB` and `REGEXP`
 * operators exist (`REGEXP` calls a user function `regexp`, SQLT-34); `isOperand`: what may follow `IS [NOT]`
 * ("null" = only NULL as in the shared parser, "value" = any value or `DISTINCT FROM`, null-safe, SQLT-33); `limitComma`:
 * `LIMIT offset, count` (SQLT-37).
 * Query facts (SQLT-28, #101): `groupByRule`: a grouped SELECT may only use grouped columns or aggregates outside
 * aggregates (PostgreSQL; SQLite allows bare columns next to an aggregate); `exprKeys` "name" = an unaliased function
 * call is keyed by its function name (SEL-8), "text" = every unaliased expression is keyed by its source text.
 * `castHint`: the cast spelling the CORE-14 error (3506) suggests for a type without a TypeScript mapping.
 */
export type Dialects = {
	postgres: {
		title: "PostgreSQL"
		onlyError: Errors["POSTGRES_ONLY_SYNTAX"]
		defaultSchemaExists: false
		typeNames: "named"
		pkImpliesNotNull: true
		rowidTables: false
		typelessColumns: false
		ddl: false
		functionCatalog: "postgres"
		operators: "builtin"
		globRegexp: false
		isOperand: "null"
		limitComma: false
		groupByRule: true
		exprKeys: "name"
		castHint: "`::text`"
	}
	sqlite: {
		title: "SQLite"
		onlyError: Errors["SQLITE_ONLY_SYNTAX"]
		defaultSchemaExists: true
		typeNames: "affinity"
		pkImpliesNotNull: false
		rowidTables: true
		typelessColumns: true
		ddl: true
		functionCatalog: "sqlite"
		operators: "sqlite"
		globRegexp: true
		isOperand: "value"
		limitComma: true
		groupByRule: false
		exprKeys: "text"
		castHint: "`CAST(x AS TEXT)`"
	}
}

/** The `Syntax` flag that names a chain's dialect. */
export type DialectFlag<D extends DialectName> = `dialect:${D}`

export type DialectFlags = DialectFlag<DialectName>

/** Everything the lexer/parser `Syntax` union may hold: driver lexer features plus the dialect flag. */
export type ParserSyntax = LexerFeatures | DialectFlags

/** The parser syntax of a driver config: its lexer features plus its dialect flag (DSEL-1, DSEL-3). */
export type ParserSyntaxOf<Config extends { syntax: LexerFeatures; dialect: DialectName }> =
	| Config["syntax"]
	| DialectFlag<Config["dialect"]>

/**
 * Constructs that exist in one engine only (DSEL-5, DSEL-6). `name` is how the message names the construct, `hint`
 * the suggested replacement in the chain's own dialect ("" for none); `<next>` in a hint is replaced by the next
 * word of the SQL, upper-cased (`id::text` → `Use CAST(x AS TEXT)`).
 * The full PostgreSQL-only list is SQLT-53; rows are added by the issues that own them.
 */
export type DialectOnlyConstructs = {
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
export type DialectPhrases = {
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
 * One fact of the dialect row (see {@link Dialects}) of a database state: the state of a chain carries its dialect
 * (`dialect` of {@link JsqlDatabaseShape}), which every parser already receives; the parser monad's own state is
 * not readable by parsers (monad checker). A state without one (PostgreSQL chains, dialect-neutral low-level
 * parsing) answers with the PostgreSQL row, which is what the parser did before dialects.
 */
export type DialectFact<Db, Fact extends keyof Dialects[DialectName]> = Db extends {
	dialect: infer D extends DialectName
}
	? Dialects[D][Fact]
	: Dialects["postgres"][Fact]

/**
 * SQLT-6: the affinity SQLite derives from a declared type name (lower-case, words joined by one space), by its
 * five rules in order; SQLT-8 / SQLT-9 / SQLT-11 name exceptions that keep a name apart. The result is the type name
 * of the column's shape: a key of the SQLite driver's type map (`integer`, `real`, `text`, `numeric`, `blob`,
 * `boolean`, `any`).
 */
export type SqliteTypeKey<Name extends string> = Name extends "any"
	? "any"
	: Name extends "boolean" | "bool"
		? "boolean"
		: Name extends "date" | "datetime" | "timestamp" | "time" | "json"
			? "text"
			: Name extends `${string}int${string}`
				? "integer"
				: Name extends `${string}char${string}` | `${string}clob${string}` | `${string}text${string}`
					? "text"
					: Name extends `${string}blob${string}`
						? "blob"
						: Name extends `${string}real${string}` | `${string}floa${string}` | `${string}doub${string}`
							? "real"
							: "numeric"

/** SQLT-11: the only type names a STRICT table allows. */
export type SqliteStrictTypeNames = "int" | "integer" | "real" | "text" | "blob" | "any"

/** SQLT-15: the names of the rowid pseudo-columns. */
export type SqliteRowidNames = "rowid" | "oid" | "_rowid_"

/** `true` for exactly one member, `false` for `never` or a union. */
type IsSingle<U, All = U> = [U] extends [never] ? false : U extends unknown ? ([All] extends [U] ? true : false) : never

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
 * (see {@link DialectFact}; a state without one is PostgreSQL).
 */
export type DbDialectOnlyError<Db, Construct extends DialectConstruct, NextWord extends string = ""> = Db extends {
	dialect: infer D extends DialectName
}
	? DialectOnlyError<DialectFlag<D>, Construct, NextWord>
	: DialectOnlyError<DialectFlag<"postgres">, Construct, NextWord>

/** All other-dialect error descriptions; they share one message shape: construct, this chain's dialect, hint. */
type OtherDialectErrors = Dialects[DialectName]["onlyError"]

type FormatHint<Hint extends string, NextWord extends string> = Hint extends ""
	? ""
	: Hint extends `${infer Before}<next>${infer After}`
		? `. ${Before}${NextWord extends "" ? "type" : Uppercase<NextWord>}${After}`
		: `. ${Hint}`

/** First recorded error wins; a later one is dropped. */
export type KeepFirstDialectError<
	Recorded extends DbtyperErrorShape | null,
	New extends DbtyperErrorShape | null,
> = Recorded extends DbtyperErrorShape ? Recorded : New
