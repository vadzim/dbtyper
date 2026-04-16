import type { TokensList, PeekToken, SkipToken, SqlParserError } from "../../core/sql-tokens.ts"

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"` ? X : S extends `\`${infer X}\`` ? X : S

type AppendToken<Acc extends string, Tok extends string> = Acc extends "" ? Tok : `${Acc} ${Tok}`

type FindFirstOpenParen<Tokens extends TokensList> =
	PeekToken<Tokens> extends "(" ? [SkipToken<Tokens>, ""] : FindFirstOpenParen<SkipToken<Tokens>>

/** `[afterClose, innerSource]` — `innerSource` is the source text inside `(`; `afterClose` is after the matching `)`. */
export type ReadFirstParenGroup<Tokens extends TokensList> =
	FindFirstOpenParen<Tokens> extends [infer AfterOpen extends TokensList, infer InnerSource extends string]
		? ReadParenGroupTail<AfterOpen, InnerSource, []>
		: never

type ReadParenGroupTail<Tokens extends TokensList, InnerSource extends string, Depth extends 0[]> =
	PeekToken<Tokens> extends ""
		? never
		: PeekToken<Tokens> extends "("
			? ReadParenGroupTail<SkipToken<Tokens>, AppendToken<InnerSource, "(">, [0, ...Depth]>
			: PeekToken<Tokens> extends ")"
				? Depth extends [0, ...infer Tail extends 0[]]
					? ReadParenGroupTail<SkipToken<Tokens>, AppendToken<InnerSource, ")">, Tail>
					: [SkipToken<Tokens>, InnerSource]
				: ReadParenGroupTail<SkipToken<Tokens>, AppendToken<InnerSource, PeekToken<Tokens>>, Depth>

export type SqlQualifiedIdentifier = [name: string] | [name: string, schema: string]

export type ConsumeStatementEnd<Tokens extends TokensList> =
	PeekToken<Tokens> extends ";" | "" ? [SkipToken<Tokens>, true] : [Tokens, false]

export type ReadExpectedToken<Tokens extends TokensList, Expected extends string, Message extends string> =
	PeekToken<Tokens> extends Expected ? [SkipToken<Tokens>, true] : [Tokens, SqlParserError<Message>]

export type ReadOptionalToken<Tokens extends TokensList, Expected extends string> =
	PeekToken<Tokens> extends Expected ? [SkipToken<Tokens>, true] : [Tokens, false]

export type ReadExpectedIdentifier<Tokens extends TokensList, Message extends string> =
	StripIdentifierQuotes<PeekToken<Tokens>> extends infer Name extends string
		? Name extends ""
			? [Tokens, SqlParserError<Message>]
			: [SkipToken<Tokens>, Name]
		: [Tokens, SqlParserError<Message>]

export type ReadOptionalIfExists<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "if"> extends [infer RestIf extends TokensList, infer HasIf extends boolean]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer RestExists extends TokensList,
					infer ExistsResult,
				]
				? ExistsResult extends SqlParserError<string>
					? [RestExists, ExistsResult]
					: [RestExists, true]
				: never
			: [RestIf, false]
		: never

export type ReadOptionalIfNotExists<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "if"> extends [infer RestIf extends TokensList, infer HasIf extends boolean]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer RestNot extends TokensList,
					infer NotResult,
				]
				? NotResult extends SqlParserError<string>
					? [RestNot, NotResult]
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer RestExists extends TokensList,
								infer ExistsResult,
						  ]
						? ExistsResult extends SqlParserError<string>
							? [RestExists, ExistsResult]
							: [RestExists, true]
						: never
				: never
			: [RestIf, false]
		: never

export type ReadQualifiedIdentifierFromBuffer<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Unable to parse identifier"> extends [
		infer RestA extends TokensList,
		infer A extends string,
	]
		? ReadQualifiedIdentifierTail<RestA, A>
		: never

type ReadQualifiedIdentifierTail<Tokens extends TokensList, A extends string> =
	ReadOptionalToken<Tokens, "."> extends [infer RestDot extends TokensList, infer HasDot extends boolean]
		? HasDot extends true
			? ReadExpectedIdentifier<RestDot, "Unable to parse identifier"> extends [
					infer RestB extends TokensList,
					infer B2,
				]
				? B2 extends string
					? [RestB, [B2, A]]
					: [RestB, Extract<B2, SqlParserError<string>>]
				: never
			: [RestDot, [A]]
		: never

/** `[rest, true]` when the next token is EOF; `[tokens, false]` when there is more input. */
export type IsBufferEnd<Tokens extends TokensList> =
	PeekToken<Tokens> extends "" ? [SkipToken<Tokens>, true] : [Tokens, false]
