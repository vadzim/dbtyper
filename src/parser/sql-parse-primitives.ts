import type { SqlParseError } from "./sql-parse-error.js"
import type { ReadToken } from "./sql-tokens.js"

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

type FindFirstOpenParen<S extends string> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? Rest
		: FindFirstOpenParen<Rest>
	: never
type ReadParenContent<
	S extends string,
	Depth extends 0[] = [],
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? ReadParenContent<Rest, [0, ...Depth], `${Acc}${C}`>
		: C extends ")"
			? Depth extends [0, ...infer Tail extends 0[]]
				? ReadParenContent<Rest, Tail, `${Acc}${C}`>
				: [Acc, Rest]
			: ReadParenContent<Rest, Depth, `${Acc}${C}`>
	: never

export type FirstParenGroup<S extends string> =
	FindFirstOpenParen<S> extends infer Rest extends string
		? ReadParenContent<Rest> extends [infer Group extends string, string]
			? Group
			: never
		: never

export type ReadFirstParenGroup<S extends string> =
	FindFirstOpenParen<S> extends infer Rest extends string
		? ReadParenContent<Rest> extends [
				infer Group extends string,
				infer Tail extends string,
			]
			? [Group, Tail]
			: never
		: never

export type NormalizeSql<S extends string> = Trim<RemoveTrailingSemicolon<StripSqlComments<S>>>

export type SqlQualifiedIdentifier = readonly [name: string] | readonly [name: string, schema: string]

export type ParseResult<Result, Rest extends string> = [result: Result, rest: Rest]
export type ParseFailure<Message extends string, Rest extends string> = ParseResult<SqlParseError<Message>, Rest>
export type ParseOutput<Result, Rest extends string> = ParseResult<Result | SqlParseError<string>, Rest>
export type IsTokenRestEmpty<S extends string> =
	ReadToken<S> extends [infer Token extends string, infer Rest extends string]
		? Token extends ""
			? true
			: Token extends ";"
				? IsTokenRestEmpty<Rest>
				: false
		: false

export type ReadExpectedToken<S extends string, Expected extends string, Message extends string> =
	ReadToken<S> extends [infer Token extends string, infer Rest extends string]
		? Token extends Expected
			? ParseResult<true, Rest>
			: ParseFailure<Message, S>
		: ParseFailure<Message, S>

export type ReadOptionalToken<S extends string, Expected extends string> =
	ReadToken<S> extends [infer Token extends string, infer Rest extends string]
		? Token extends Expected
			? ParseResult<true, Rest>
			: ParseResult<false, S>
		: ParseResult<false, S>

export type ReadExpectedIdentifier<S extends string, Message extends string> =
	ReadIdentifier<Trim<S>> extends [infer Raw extends string, infer Rest extends string]
		? StripIdentifierQuotes<Raw> extends infer Name extends string
			? Name extends ""
				? ParseFailure<Message, S>
				: ParseResult<Name, Rest>
			: ParseFailure<Message, S>
		: ParseFailure<Message, S>

export type ReadOptionalIfExists<S extends string> =
	ReadOptionalToken<S, "if"> extends [infer HasIf extends boolean, infer RestIf extends string]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "exists", "Expected EXISTS after IF"> extends [
					infer ExistsResult,
					infer RestExists extends string,
				]
				? ExistsResult extends SqlParseError<string>
					? ParseResult<ExistsResult, RestExists>
					: ParseResult<true, RestExists>
				: ParseFailure<"Expected EXISTS after IF", S>
			: ParseResult<false, RestIf>
		: ParseResult<false, S>

export type ReadOptionalIfNotExists<S extends string> =
	ReadOptionalToken<S, "if"> extends [infer HasIf extends boolean, infer RestIf extends string]
		? HasIf extends true
			? ReadExpectedToken<RestIf, "not", "Expected NOT after IF"> extends [
					infer NotResult,
					infer RestNot extends string,
				]
				? NotResult extends SqlParseError<string>
					? ParseResult<NotResult, RestNot>
					: ReadExpectedToken<RestNot, "exists", "Expected EXISTS after IF NOT"> extends [
								infer ExistsResult,
								infer RestExists extends string,
						  ]
						? ExistsResult extends SqlParseError<string>
							? ParseResult<ExistsResult, RestExists>
							: ParseResult<true, RestExists>
						: ParseFailure<"Expected EXISTS after IF NOT", S>
				: ParseFailure<"Expected NOT after IF", S>
			: ParseResult<false, RestIf>
		: ParseResult<false, S>

export type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [readonly [StripIdentifierQuotes<B>, StripIdentifierQuotes<A>], RestB]
				: [readonly [StripIdentifierQuotes<A>], RestA]
			: [readonly [StripIdentifierQuotes<A>], RestA]
		: never
