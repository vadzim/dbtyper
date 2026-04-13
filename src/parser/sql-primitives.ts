import type { TokensList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"` ? X : S extends `\`${infer X}\`` ? X : S

type FindFirstOpenParen<Tokens extends TokensList> =
	PeekToken<Tokens> extends "(" ? SkipToken<Tokens> : FindFirstOpenParen<SkipToken<Tokens>>

/** `[innerStart, afterClose]` — `innerStart` is the buffer after `(`; `afterClose` is after the matching `)`. */
export type ReadFirstParenGroup<Tokens extends TokensList> =
	FindFirstOpenParen<Tokens> extends infer AfterOpen extends TokensList
		? ReadParenGroupTail<AfterOpen, AfterOpen, []>
		: never

type ReadParenGroupTail<AfterOpen extends TokensList, Cur extends TokensList, Depth extends 0[]> =
	PeekToken<Cur> extends ""
		? never
		: PeekToken<Cur> extends "("
			? ReadParenGroupTail<AfterOpen, SkipToken<Cur>, [0, ...Depth]>
			: PeekToken<Cur> extends ")"
				? Depth extends [0, ...infer Tail extends 0[]]
					? ReadParenGroupTail<AfterOpen, SkipToken<Cur>, Tail>
					: [AfterOpen, SkipToken<Cur>]
				: ReadParenGroupTail<AfterOpen, SkipToken<Cur>, Depth>

export type SqlQualifiedIdentifier = readonly [name: string] | readonly [name: string, schema: string]

export type ParseResult<Result, Rest> = [result: Result, rest: Rest]
export type ParseFailure<Message extends string, Rest> = ParseResult<SqlParserError<Message>, Rest>
export type ParseOutput<Result, Rest> = ParseResult<Result | SqlParserError<string>, Rest>
export type ConsumeStatementEnd<Tokens extends TokensList> =
	PeekToken<Tokens> extends ";" | "" ? ParseResult<true, SkipToken<Tokens>> : ParseResult<false, Tokens>

export type ReadExpectedToken<Tokens extends TokensList, Expected extends string, Message extends string> =
	PeekToken<Tokens> extends Expected ? ParseResult<true, SkipToken<Tokens>> : ParseFailure<Message, Tokens>

export type ReadOptionalToken<Tokens extends TokensList, Expected extends string> =
	PeekToken<Tokens> extends Expected ? ParseResult<true, SkipToken<Tokens>> : ParseResult<false, Tokens>

export type ReadExpectedIdentifier<Tokens extends TokensList, Message extends string> =
	StripIdentifierQuotes<PeekToken<Tokens>> extends infer Name extends string
		? Name extends ""
			? ParseFailure<Message, Tokens>
			: ParseResult<Name, SkipToken<Tokens>>
		: ParseFailure<Message, Tokens>

export type ReadOptionalIfExists<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "if"> extends [infer HasIf extends boolean, infer RestIf extends TokensList]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer ExistsResult,
					infer RestExists extends TokensList,
				]
				? ExistsResult extends SqlParserError<string>
					? ParseResult<ExistsResult, RestExists>
					: ParseResult<true, RestExists>
				: ParseFailure<"Expected EXISTS after IF", Tokens>
			: ParseResult<false, RestIf>
		: ParseResult<false, Tokens>

export type ReadOptionalIfNotExists<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "if"> extends [infer HasIf extends boolean, infer RestIf extends TokensList]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer NotResult,
					infer RestNot extends TokensList,
				]
				? NotResult extends SqlParserError<string>
					? ParseResult<NotResult, RestNot>
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer ExistsResult,
								infer RestExists extends TokensList,
						  ]
						? ExistsResult extends SqlParserError<string>
							? ParseResult<ExistsResult, RestExists>
							: ParseResult<true, RestExists>
						: ParseFailure<"Expected EXISTS after IF NOT", Tokens>
				: ParseFailure<"Expected NOT after IF", Tokens>
			: ParseResult<false, RestIf>
		: ParseResult<false, Tokens>

export type ReadQualifiedIdentifierFromBuffer<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [
		infer A extends string,
		infer RestA extends TokensList,
	]
		? ReadOptionalToken<RestA, "."> extends [true, infer RestDot extends TokensList]
			? ReadExpectedIdentifier<RestDot, "Unable to parse identifier"> extends [
					infer B2 extends string,
					infer RestB extends TokensList,
				]
				? [readonly [B2, A], RestB]
				: [readonly [A], RestA]
			: [readonly [A], RestA]
		: never

/** `[true, Rest]` when the next token is EOF; `[false, Tokens]` when there is more input. Caller must branch on the first element and continue from `Rest` (on success) or `Tokens` (on failure, unchanged). */
export type IsBufferEnd<Tokens extends TokensList> = PeekToken<Tokens> extends "" ? true : false
