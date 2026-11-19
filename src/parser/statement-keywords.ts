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
