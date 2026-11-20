import type { FormatError, Errors } from "../dbtyper-error.ts"

/**
 * Statement keywords (STMT-18, STMT-19, SQLT-23, PGT-21). A statement whose first word is one of
 * {@link ParsedStatementKeywords} is parsed; one whose first word is in a dialect's skipped list is stepped over
 * unchecked; any other first word is the error {@link UnknownStatementError}. The skipped lists are the `skippedStatements` row of each dialect in the `Dialects` table (DLCT-1).
 */
/** The leading words `ParseSqlStatement` dispatches on (parse-sql-statement.ts); keep the two in step. */
type ParsedStatementKeywords = readonly [
	"select",
	"with",
	"insert",
	"update",
	"delete",
	"create",
	"alter",
	"drop",
	"replace",
]

/** All words a hint may suggest. */
type SuggestionCandidates<Known extends readonly string[]> = readonly [...ParsedStatementKeywords, ...Known]

/** STMT-19: the error for an unknown first word, with the closest known keyword when there is one. */
export type UnknownStatementError<Word extends string, Known extends readonly string[]> =
	ClosestKeyword<Lowercase<Word>, SuggestionCandidates<Known>> extends infer Close extends string
		? [Close] extends [never]
			? FormatError<Errors["UNKNOWN_STATEMENT"], [Word]>
			: FormatError<Errors["UNKNOWN_STATEMENT_DID_YOU_MEAN"], [Word, Uppercase<Close>]>
		: never

/** The first candidate one edit away from the word (words of 4+ letters only, so `go` does not become `do`). */
type ClosestKeyword<
	Word extends string,
	Candidates extends readonly string[],
> = Word extends `${infer _1}${infer _2}${infer _3}${infer _4}${string}` ? FirstNear<Word, Candidates> : never

type FirstNear<Word extends string, Candidates extends readonly string[]> = Candidates extends readonly [
	infer Head extends string,
	...infer Tail extends readonly string[],
]
	? IsOneEdit<Word, Head> extends true
		? Head
		: FirstNear<Word, Tail>
	: never

/** One substitution, insertion, deletion or swap of two neighbours turns `A` into `B` (`A` itself does not count). */
type IsOneEdit<A extends string, B extends string> = A extends `${infer a}${infer ar}`
	? B extends `${infer b}${infer br}`
		? a extends b
			? IsOneEdit<ar, br>
			: ar extends br
				? true // substitution
				: ar extends B
					? true // A has an extra letter
					: A extends br
						? true // B has an extra letter
						: ar extends `${b}${infer ar2}`
							? br extends `${a}${infer br2}`
								? ar2 extends br2
									? true // swapped neighbours
									: false
								: false
							: false
		: A extends `${string}${infer Rest}`
			? Rest extends ""
				? true
				: false
			: false
	: B extends `${string}${infer Rest}`
		? Rest extends ""
			? true
			: false
		: false

/**
 * Second words of `CREATE` / `ALTER` / `DROP` (#158). The parsed ones are dispatched by parse-sql-statement.ts (keep
 * the two in step); the skipped ones are the `skippedForms` fact of each dialect (rows below). Any other second word
 * is the error {@link UnknownFormError}: a typo such as `create tabel` is never skipped silently.
 */
type ParsedForms = {
	create: readonly [
		"table",
		"schema",
		"type",
		"view",
		"domain",
		"unlogged",
		"materialized",
		"or",
		"temp",
		"temporary",
		"trigger",
		"virtual",
	]
	alter: readonly ["table", "type"]
	drop: readonly ["table", "schema", "type", "view", "materialized", "domain"]
}

export type StatementVerb = keyof ParsedForms

/** The skipped second words of a dialect, one list per verb (the `skippedForms` fact). */
export type SkippedFormsShape = { [V in StatementVerb]: readonly string[] }

/** Objects PostgreSQL creates, alters and drops that change no table, view or type dbtyper types (PGT-21). */
type PostgresUntypedObjects = readonly [
	"index",
	"sequence",
	"extension",
	"function",
	"procedure",
	"routine",
	"aggregate",
	"operator",
	"cast",
	"collation",
	"conversion",
	"language",
	"transform",
	"policy",
	"rule",
	"role",
	"user",
	"group",
	"database",
	"tablespace",
	"event",
	"foreign",
	"server",
	"publication",
	"subscription",
	"statistics",
	"text",
	"access",
]

/** PostgreSQL: `CREATE UNIQUE INDEX`, `CREATE CONSTRAINT TRIGGER`; `ALTER DEFAULT PRIVILEGES`, `ALTER VIEW`, `ALTER SCHEMA` (a RENAME of these is an error, {@link RenameUntracked}); `DROP TRIGGER`, `DROP OWNED`. */
export type PostgresSkippedForms = {
	create: readonly [...PostgresUntypedObjects, "unique", "constraint"]
	alter: readonly [
		...PostgresUntypedObjects,
		"trigger",
		"default",
		"large",
		"system",
		"view",
		"materialized",
		"schema",
		"domain",
	]
	drop: readonly [...PostgresUntypedObjects, "trigger", "owned"]
}

/** SQLite: `CREATE [UNIQUE] INDEX`, `DROP INDEX`, `DROP TRIGGER` (SQLT-23); its ALTER has only TABLE. */
export type SqliteSkippedForms = {
	create: readonly ["index", "unique"]
	alter: readonly []
	drop: readonly ["index", "trigger"]
}

/** Skipped ALTER forms whose `RENAME` changes a name dbtyper types: an error, never a silent skip (STMT-Q2). */
export type RenameUntracked = {
	view: "Use DROP VIEW and CREATE VIEW"
	materialized: "Use DROP MATERIALIZED VIEW and CREATE MATERIALIZED VIEW"
	schema: "Create the new schema and move the objects"
}

/** #158: the error for an unknown second word of `Verb` (`create tabel`), with the closest known form when there is one. */
export type UnknownFormError<Verb extends StatementVerb, Word extends string, Skipped extends readonly string[]> =
	ClosestKeyword<Lowercase<Word>, readonly [...ParsedForms[Verb], ...Skipped]> extends infer Close extends string
		? [Close] extends [never]
			? FormatError<Errors["UNKNOWN_STATEMENT_FORM"], [Uppercase<Verb>, Word]>
			: FormatError<
					Errors["UNKNOWN_STATEMENT_FORM_DID_YOU_MEAN"],
					[Uppercase<Verb>, Word, Uppercase<Verb>, Uppercase<Close>]
				>
		: never
