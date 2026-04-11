import type { BufferLike, BufferPayload, InitBuffer, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

/** Low-level string / identifier parsing for SQL template literals. */

export type Ws = " " | "\n" | "\t" | "\r"
export type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S
export type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S
export type Trim<S extends string> = TrimLeft<TrimRight<S>>
export type RemoveTrailingSemicolon<S extends string> = Trim<S> extends `${infer X};` ? Trim<X> : Trim<S>
export type ToLower<S extends string> = Lowercase<S>

type ReadDoubleQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends `"`
		? [`"${Acc}"`, Rest]
		: ReadDoubleQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`"${Acc}"`, ""]
type ReadBacktickQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "`"
		? [`\`${Acc}\``, Rest]
		: ReadBacktickQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`\`${Acc}\``, ""]
export type ReadIdentifier<S extends string> =
	Trim<S> extends `"${infer Rest}`
		? ReadDoubleQuotedIdentifier<Rest>
		: Trim<S> extends `\`${infer Rest}`
			? ReadBacktickQuotedIdentifier<Rest>
			: ReadWord<Trim<S>>

export type ReadWord<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends Ws | "," | "(" | ")" | "." | ";"
		? [Acc, `${C}${Rest}`]
		: ReadWord<Rest, `${Acc}${C}`>
	: [Acc, ""]

export type ReadUntilTopLevelComma<
	S extends string,
	Depth extends 0[] = [],
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? ReadUntilTopLevelComma<Rest, [0, ...Depth], `${Acc}${C}`>
		: C extends ")"
			? Depth extends [0, ...infer Tail extends 0[]]
				? ReadUntilTopLevelComma<Rest, Tail, `${Acc}${C}`>
				: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
			: C extends ","
				? Depth["length"] extends 0
					? [Acc, Rest]
					: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
				: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
	: [Acc, ""]

export type ReadUntilTopLevelCommaBuffer<B extends BufferLike> =
	ReadUntilTopLevelComma<BufferPayload<B>> extends [infer Head extends string, infer Tail extends string]
		? [head: InitBuffer<Head>, tail: InitBuffer<Tail>]
		: never

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"`
	? X
	: S extends `\`${infer X}\``
		? X
		: S

type FindFirstOpenParen<B extends BufferLike> =
	PeekToken<B> extends "("
		? SkipToken<B>
		: FindFirstOpenParen<SkipToken<B>>

type ReadParenContentString<
	S extends string,
	Depth extends 0[] = [],
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? ReadParenContentString<Rest, [0, ...Depth], `${Acc}${C}`>
		: C extends ")"
			? Depth extends [0, ...infer Tail extends 0[]]
				? ReadParenContentString<Rest, Tail, `${Acc}${C}`>
				: [Acc, Rest]
			: ReadParenContentString<Rest, Depth, `${Acc}${C}`>
	: never

export type ReadFirstParenGroup<B extends BufferLike> =
	FindFirstOpenParen<B> extends infer Rest extends BufferLike
		? ReadParenContentString<BufferPayload<Rest>> extends [infer Group extends string, infer Tail extends string]
			? [InitBuffer<Group>, InitBuffer<Tail>]
			: never
		: never

export type FirstParenGroup<S extends string> =
	ReadFirstParenGroup<InitBuffer<S>> extends [infer Inner extends BufferLike, infer _ extends BufferLike]
		? Inner extends InitBuffer<infer G>
			? G
			: never
		: never

export type SqlQualifiedIdentifier = readonly [name: string] | readonly [name: string, schema: string]

export type ParseResult<Result, Rest> = [result: Result, rest: Rest]
export type ParseFailure<Message extends string, Rest> = ParseResult<SqlParseError<Message>, Rest>
export type ParseOutput<Result, Rest> = ParseResult<Result | SqlParseError<string>, Rest>
export type ConsumeStatementEnd<B extends BufferLike> =
	PeekToken<B> extends ";" | ""
		? ParseResult<true, SkipToken<B>>
		: ParseResult<false, B>

export type ReadExpectedToken<B extends BufferLike, Expected extends string, Message extends string> =
	PeekToken<B> extends Expected
		? ParseResult<true, SkipToken<B>>
		: ParseFailure<Message, B>

export type ReadOptionalToken<B extends BufferLike, Expected extends string> =
	PeekToken<B> extends Expected
		? ParseResult<true, SkipToken<B>>
		: ParseResult<false, B>

export type ReadExpectedIdentifier<B extends BufferLike, Message extends string> =
	StripIdentifierQuotes<Trim<PeekToken<B>>> extends infer Name extends string
		? Name extends ""
			? ParseFailure<Message, B>
			: ParseResult<Name, SkipToken<B>>
		: ParseFailure<Message, B>

export type ReadOptionalIfExists<B extends BufferLike> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends BufferLike]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer ExistsResult,
					infer RestExists extends BufferLike,
				]
				? ExistsResult extends SqlParseError<string>
					? ParseResult<ExistsResult, RestExists>
					: ParseResult<true, RestExists>
				: ParseFailure<"Expected EXISTS after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadOptionalIfNotExists<B extends BufferLike> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends BufferLike]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer NotResult,
					infer RestNot extends BufferLike,
				]
				? NotResult extends SqlParseError<string>
					? ParseResult<NotResult, RestNot>
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer ExistsResult,
								infer RestExists extends BufferLike,
						  ]
						? ExistsResult extends SqlParseError<string>
							? ParseResult<ExistsResult, RestExists>
							: ParseResult<true, RestExists>
						: ParseFailure<"Expected EXISTS after IF NOT", B>
				: ParseFailure<"Expected NOT after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadQualifiedIdentifierFromBuffer<B extends BufferLike> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [
		infer A extends string,
		infer RestA extends BufferLike,
	]
		? ReadOptionalToken<RestA, "."> extends [true, infer RestDot extends BufferLike]
			? ReadExpectedIdentifier<RestDot, "Unable to parse identifier"> extends [
					infer B2 extends string,
					infer RestB extends BufferLike,
				]
				? [readonly [B2, A], RestB]
				: [readonly [A], RestA]
			: [readonly [A], RestA]
		: never

export type InitParseBuffer<S extends string> = InitBuffer<S>

/** `[true, Rest]` when the next token is EOF; `[false, B]` when there is more input. Caller must branch on the first element and continue from `Rest` (on success) or `B` (on failure, unchanged). */
export type ReadBufferEnd<B extends BufferLike> =
	PeekToken<B> extends ""
		? [true, SkipToken<B>]
		: [false, B]

export type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [readonly [StripIdentifierQuotes<B>, StripIdentifierQuotes<A>], RestB]
				: [readonly [StripIdentifierQuotes<A>], RestA]
			: [readonly [StripIdentifierQuotes<A>], RestA]
		: never
