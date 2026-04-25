import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenType } from "../../core/sql-tokens.ts"

export type SqlQualifiedIdentifier = [name: string] | [name: string, schema: string]

export type ConsumeStatementEnd<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", ";"> | TokenType<"eot", ""> ? [SkipToken<Tokens>, true] : [Tokens, false]

export type ReadExpectedToken<Tokens extends TokensList, Expected extends string, Message extends string> =
	PeekToken<Tokens> extends TokenType<"key", Expected> ? [SkipToken<Tokens>, true] : [Tokens, SqlParserError<Message>]

export type ReadOptionalToken<Tokens extends TokensList, Expected extends string> =
	PeekToken<Tokens> extends TokenType<"key", Expected> ? [SkipToken<Tokens>, true] : [Tokens, false]

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
	PeekToken<Tokens> extends TokenType<"ident", infer A extends string>
		? ReadQualifiedIdentifierTail<SkipToken<Tokens>, A>
		: [Tokens, SqlParserError<"Unable to parse identifier">]

type ReadQualifiedIdentifierTail<Tokens extends TokensList, A extends string> =
	ReadOptionalToken<Tokens, "."> extends [infer RestDot extends TokensList, infer HasDot extends boolean]
		? HasDot extends true
			? PeekToken<RestDot> extends TokenType<"ident", infer B2 extends string>
				? [SkipToken<RestDot>, [B2, A]]
				: [RestDot, SqlParserError<"Unable to parse identifier">]
			: [RestDot, [A]]
		: never
