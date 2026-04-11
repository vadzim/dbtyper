import type { TokensList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

/** Low-level string / identifier parsing for SQL template literals. */

export type Ws = " " | "\n" | "\t" | "\r"
export type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S
export type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S
export type Trim<S extends string> = TrimLeft<TrimRight<S>>
export type ToLower<S extends string> = Lowercase<S>

/** Walks from `B` and returns the buffer **after** the first top-level `,` token. If none, returns the buffer at EOF (`PeekToken` is `""`). */
export type SkipPastFirstTopLevelComma<B extends TokensList, Depth extends 0[] = []> =
	PeekToken<B> extends ""
		? B
		: PeekToken<B> extends "("
			? SkipPastFirstTopLevelComma<SkipToken<B>, [0, ...Depth]>
			: PeekToken<B> extends ")"
				? Depth extends [0, ...infer Tail extends 0[]]
					? SkipPastFirstTopLevelComma<SkipToken<B>, Tail>
					: SkipPastFirstTopLevelComma<SkipToken<B>, Depth>
				: PeekToken<B> extends ","
					? Depth["length"] extends 0
						? SkipToken<B>
						: SkipPastFirstTopLevelComma<SkipToken<B>, Depth>
					: SkipPastFirstTopLevelComma<SkipToken<B>, Depth>

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"` ? X : S extends `\`${infer X}\`` ? X : S

type FindFirstOpenParen<B extends TokensList> =
	PeekToken<B> extends "(" ? SkipToken<B> : FindFirstOpenParen<SkipToken<B>>

/** `[innerStart, afterClose]` — `innerStart` is the buffer after `(`; `afterClose` is after the matching `)`. */
export type ReadFirstParenGroup<B extends TokensList> =
	FindFirstOpenParen<B> extends infer AfterOpen extends TokensList
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
export type ParseFailure<Message extends string, Rest> = ParseResult<SqlParseError<Message>, Rest>
export type ParseOutput<Result, Rest> = ParseResult<Result | SqlParseError<string>, Rest>
export type ConsumeStatementEnd<B extends TokensList> =
	PeekToken<B> extends ";" | "" ? ParseResult<true, SkipToken<B>> : ParseResult<false, B>

export type ReadExpectedToken<B extends TokensList, Expected extends string, Message extends string> =
	PeekToken<B> extends Expected ? ParseResult<true, SkipToken<B>> : ParseFailure<Message, B>

export type ReadOptionalToken<B extends TokensList, Expected extends string> =
	PeekToken<B> extends Expected ? ParseResult<true, SkipToken<B>> : ParseResult<false, B>

export type ReadExpectedIdentifier<B extends TokensList, Message extends string> =
	StripIdentifierQuotes<Trim<PeekToken<B>>> extends infer Name extends string
		? Name extends ""
			? ParseFailure<Message, B>
			: ParseResult<Name, SkipToken<B>>
		: ParseFailure<Message, B>

export type ReadOptionalIfExists<B extends TokensList> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends TokensList]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer ExistsResult,
					infer RestExists extends TokensList,
				]
				? ExistsResult extends SqlParseError<string>
					? ParseResult<ExistsResult, RestExists>
					: ParseResult<true, RestExists>
				: ParseFailure<"Expected EXISTS after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadOptionalIfNotExists<B extends TokensList> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends TokensList]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer NotResult,
					infer RestNot extends TokensList,
				]
				? NotResult extends SqlParseError<string>
					? ParseResult<NotResult, RestNot>
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer ExistsResult,
								infer RestExists extends TokensList,
						  ]
						? ExistsResult extends SqlParseError<string>
							? ParseResult<ExistsResult, RestExists>
							: ParseResult<true, RestExists>
						: ParseFailure<"Expected EXISTS after IF NOT", B>
				: ParseFailure<"Expected NOT after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadQualifiedIdentifierFromBuffer<B extends TokensList> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [
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

/** `[true, Rest]` when the next token is EOF; `[false, B]` when there is more input. Caller must branch on the first element and continue from `Rest` (on success) or `B` (on failure, unchanged). */
export type ReadBufferEnd<B extends TokensList> = PeekToken<B> extends "" ? [true, SkipToken<B>] : [false, B]
