import type {
	ReadExpectedToken,
	ReadOptionalToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { SkipStatement, SkippedStatement } from "./skip-statement.ts"
import type {
	TokensList,
	PeekToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
} from "../../core/sql-tokens.ts"

export type SelectStatement = {
	kind: "select"
	columns: "star" | string[]
	from: SqlQualifiedIdentifier
}

/** End of `SELECT` tail: statement terminator, end of input, or closing paren (subselect). */
export type SelectStatementEnd = TokenEot | TokenKey<";"> | TokenKey<")">

/**
 * `Tokens` must point **after** the `select` keyword (see `parse-sql-statement` dispatch).
 * One forward pass: optional `distinct`, select list, `from`, table id, then `SkipStatement` to `EndToken`.
 */
export type ParseSelect<Tokens extends TokensList, EndToken extends SelectStatementEnd = SelectStatementEnd> =
	ReadOptionalToken<Tokens, "distinct"> extends [infer R0 extends TokensList, unknown]
		? ParseSelectList<R0> extends [infer R1 extends TokensList, infer ListResult]
			? ListResult extends SqlParserError<string>
				? [R1, ListResult]
				: ListResult extends "star" | string[]
					? AfterSelectList<R1, ListResult, EndToken>
					: never
			: never
		: never

type AfterSelectList<
	Tokens extends TokensList,
	ListResult extends "star" | string[],
	EndToken extends SelectStatementEnd,
> =
	ReadExpectedToken<Tokens, "from", "Expected FROM after SELECT list"> extends [
		infer R2 extends TokensList,
		infer FromOk,
	]
		? FromOk extends true
			? AfterFromKeyword<R2, ListResult, EndToken>
			: [R2, Extract<FromOk, SqlParserError<string>>]
		: never

type AfterFromKeyword<
	Tokens extends TokensList,
	ListResult extends "star" | string[],
	EndToken extends SelectStatementEnd,
> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [infer R3 extends TokensList, infer TableResult]
		? TableResult extends SqlParserError<string>
			? [R3, TableResult]
			: TableResult extends SqlQualifiedIdentifier
				? SkipStatement<R3, EndToken> extends [infer R4 extends TokensList, infer SkipResult]
					? SkipResult extends SkippedStatement
						? [
								R4,
								{
									kind: "select"
									columns: ListResult
									from: TableResult
								},
							]
						: SkipResult extends SqlParserError<string>
							? [R4, SkipResult]
							: [R4, SqlParserError<"Internal SELECT tail skip">]
					: never
				: never
		: never

type ParseSelectList<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"*">
		? [SkipToken<Tokens>, "star"]
		: PeekToken<Tokens> extends TokenIdent<infer A extends string>
			? ParseSelectListTail<SkipToken<Tokens>, [A]>
			: [Tokens, SqlParserError<"Expected * or column name in SELECT list">]

type ParseSelectListTail<Tokens extends TokensList, Acc extends string[]> =
	ReadOptionalToken<Tokens, ","> extends [infer R extends TokensList, infer HasComma extends boolean]
		? HasComma extends true
			? PeekToken<R> extends TokenIdent<infer B extends string>
				? ParseSelectListTail<SkipToken<R>, [...Acc, B]>
				: [R, SqlParserError<"Expected column name after , in SELECT list">]
			: [R, Acc]
		: never
