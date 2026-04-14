import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"` ? X : S extends `\`${infer X}\`` ? X : S

type FindFirstOpenParen<Tokens extends TokensList> =
	PeekToken<Tokens> extends "(" ? SkipToken<Tokens> : FindFirstOpenParen<SkipToken<Tokens>>

/** Fixed inner cursor + moving cursor as one tuple so `AfterOpen` is not passed to two `@consume` parameters. */
type ParenScanState = readonly [inner: TokensList, cur: TokensList]

/** `[innerStart, afterClose]` — `innerStart` is the buffer after `(`; `afterClose` is after the matching `)`. */
export type ReadFirstParenGroup<Tokens extends TokensList> =
	FindFirstOpenParen<Tokens> extends infer AfterOpen extends TokensList
		? ReadParenGroupTail<readonly [AfterOpen, AfterOpen], []>
		: never

type ReadParenGroupTail<State extends ParenScanState, Depth extends 0[]> =
	State extends readonly [infer Inner extends TokensList, infer Cur extends TokensList]
		? PeekToken<Cur> extends ""
			? never
			: PeekToken<Cur> extends "("
				? SkipToken<Cur> extends infer Next extends TokensList
					? ReadParenGroupTail<readonly [Inner, Next], [0, ...Depth]>
					: never
				: PeekToken<Cur> extends ")"
					? Depth extends [0, ...infer Tail extends 0[]]
						? SkipToken<Cur> extends infer Next extends TokensList
							? ReadParenGroupTail<readonly [Inner, Next], Tail>
							: never
						: SkipToken<Cur> extends infer Next extends TokensList
							? [Inner, Next]
							: never
					: SkipToken<Cur> extends infer Next extends TokensList
						? ReadParenGroupTail<readonly [Inner, Next], Depth>
						: never
		: never

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
				: ParseFailure<"Expected EXISTS after IF", EmptyTokenList>
			: ParseResult<false, RestIf>
		: ParseResult<false, EmptyTokenList>

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
						: ParseFailure<"Expected EXISTS after IF NOT", EmptyTokenList>
				: ParseFailure<"Expected NOT after IF", EmptyTokenList>
			: ParseResult<false, RestIf>
		: ParseResult<false, EmptyTokenList>

export type ReadQualifiedIdentifierFromBuffer<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [
		infer A extends string,
		infer RestA extends TokensList,
	]
		? ReadQualifiedIdentifierTail<A, readonly [RestA]>
		: never

type ReadQualifiedIdentifierTail<A extends string, RestCell extends readonly [TokensList]> =
	ReadOptionalToken<RestCell[0], "."> extends [infer HasDot extends boolean, infer RestDot extends TokensList]
		? HasDot extends true
			? ReadExpectedIdentifier<RestDot, "Unable to parse identifier"> extends [
					infer B2 extends string,
					infer RestB extends TokensList,
				]
				? [readonly [B2, A], RestB]
				: [readonly [A], RestCell[0]]
			: [readonly [A], RestCell[0]]
		: never

/** `[true, Rest]` when the next token is EOF; `[false, Tokens]` when there is more input. Caller must branch on the first element and continue from `Rest` (on success) or `Tokens` (on failure, unchanged). */
export type IsBufferEnd<Tokens extends TokensList> = PeekToken<Tokens> extends "" ? true : false
