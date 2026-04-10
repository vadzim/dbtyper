import type { SqlParseError } from "./sql-parse-error.js"
import type { Buffer, BufferPayload, InitBuffer, ReadToken } from "./sql-tokens.js"

/** Low-level string / identifier parsing for SQL template literals. */

export type Ws = " " | "\n" | "\t" | "\r"
export type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S
export type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S
export type Trim<S extends string> = TrimLeft<TrimRight<S>>
export type RemoveTrailingSemicolon<S extends string> = Trim<S> extends `${infer X};` ? Trim<X> : Trim<S>
export type ToLower<S extends string> = Lowercase<S>

type StripLineComment<S extends string> = S extends `${infer _Comment}\n${infer Rest}`
	? `\n${Rest}`
	: S extends `${infer _Comment}\r${infer Rest}`
		? `\r${Rest}`
		: ""
type StripBlockComment<S extends string> = S extends `${infer _Comment}*/${infer Rest}` ? Rest : ""

export type StripSqlComments<S extends string> = S extends `${infer Head}--${infer Tail}`
	? StripSqlComments<`${Head}${StripLineComment<Tail>}`>
	: S extends `${infer Head}/*${infer Tail}`
		? StripSqlComments<`${Head}${StripBlockComment<Tail>}`>
		: S

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
type ReadBracketQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "]"
		? [`[${Acc}]`, Rest]
		: ReadBracketQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`[${Acc}]`, ""]

export type ReadIdentifier<S extends string> =
	Trim<S> extends `"${infer Rest}`
		? ReadDoubleQuotedIdentifier<Rest>
		: Trim<S> extends `\`${infer Rest}`
			? ReadBacktickQuotedIdentifier<Rest>
			: Trim<S> extends `[${infer Rest}`
				? ReadBracketQuotedIdentifier<Rest>
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

export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"`
	? X
	: S extends `\`${infer X}\``
		? X
		: S extends `[${infer X}]`
			? X
			: S

type FindFirstOpenParen<B extends Buffer> =
	BufferPayload<B> extends `${infer C}${infer Rest}`
		? C extends "("
			? InitBuffer<Rest>
			: FindFirstOpenParen<InitBuffer<Rest>>
		: never

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

export type ReadFirstParenGroup<B extends Buffer> =
	FindFirstOpenParen<B> extends infer Rest extends Buffer
		? ReadParenContentString<BufferPayload<Rest>> extends [infer Group extends string, infer Tail extends string]
			? [Group, InitBuffer<Tail>]
			: never
		: never

export type FirstParenGroup<S extends string> =
	ReadFirstParenGroup<InitBuffer<S>> extends [infer Group extends string, Buffer] ? Group : never

export type SqlQualifiedIdentifier = readonly [name: string] | readonly [name: string, schema: string]

export type ParseResult<Result, Rest> = [result: Result, rest: Rest]
export type ParseFailure<Message extends string, Rest> = ParseResult<SqlParseError<Message>, Rest>
export type ParseOutput<Result, Rest> = ParseResult<Result | SqlParseError<string>, Rest>
export type ConsumeStatementEnd<B extends Buffer> =
	ReadToken<B> extends [infer Token extends string, infer Rest extends Buffer]
		? Token extends ";"
			? ParseResult<true, Rest>
			: Token extends ""
				? ParseResult<true, Rest>
				: ParseResult<false, B>
		: ParseResult<false, B>

export type ReadExpectedToken<B extends Buffer, Expected extends string, Message extends string> =
	ReadToken<B> extends [infer Token extends string, infer Rest extends Buffer]
		? Token extends Expected
			? ParseResult<true, Rest>
			: ParseFailure<Message, B>
		: ParseFailure<Message, B>

export type ReadOptionalToken<B extends Buffer, Expected extends string> =
	ReadToken<B> extends [infer Token extends string, infer Rest extends Buffer]
		? Token extends Expected
			? ParseResult<true, Rest>
			: ParseResult<false, B>
		: ParseResult<false, B>

export type ReadExpectedIdentifier<B extends Buffer, Message extends string> =
	ReadToken<B> extends [infer Raw extends string, infer Rest extends Buffer]
		? StripIdentifierQuotes<Trim<Raw>> extends infer Name extends string
			? Name extends ""
				? ParseFailure<Message, B>
				: ParseResult<Name, Rest>
			: ParseFailure<Message, B>
		: ParseFailure<Message, B>

export type ReadOptionalIfExists<B extends Buffer> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends Buffer]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer ExistsResult,
					infer RestExists extends Buffer,
				]
				? ExistsResult extends SqlParseError<string>
					? ParseResult<ExistsResult, RestExists>
					: ParseResult<true, RestExists>
				: ParseFailure<"Expected EXISTS after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadOptionalIfNotExists<B extends Buffer> =
	ReadOptionalToken<B, "if"> extends [infer HasIf extends boolean, infer RestIf extends Buffer]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer NotResult,
					infer RestNot extends Buffer,
				]
				? NotResult extends SqlParseError<string>
					? ParseResult<NotResult, RestNot>
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer ExistsResult,
								infer RestExists extends Buffer,
						  ]
						? ExistsResult extends SqlParseError<string>
							? ParseResult<ExistsResult, RestExists>
							: ParseResult<true, RestExists>
						: ParseFailure<"Expected EXISTS after IF NOT", B>
				: ParseFailure<"Expected NOT after IF", B>
			: ParseResult<false, RestIf>
		: ParseResult<false, B>

export type ReadQualifiedIdentifierFromBuffer<B extends Buffer> =
	ReadExpectedIdentifier<B, "Unable to parse identifier"> extends [infer A extends string, infer RestA extends Buffer]
		? ReadOptionalToken<RestA, "."> extends [true, infer RestDot extends Buffer]
			? ReadExpectedIdentifier<RestDot, "Unable to parse identifier"> extends [
					infer B2 extends string,
					infer RestB extends Buffer,
				]
				? [readonly [B2, A], RestB]
				: [readonly [A], RestA]
			: [readonly [A], RestA]
		: never

export type InitParseBuffer<S extends string> = InitBuffer<S>
export type IsBufferEnd<B extends Buffer> = ReadToken<B> extends ["", Buffer] ? true : false

export type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [readonly [StripIdentifierQuotes<B>, StripIdentifierQuotes<A>], RestB]
				: [readonly [StripIdentifierQuotes<A>], RestA]
			: [readonly [StripIdentifierQuotes<A>], RestA]
		: never
