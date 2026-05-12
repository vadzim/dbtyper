import type { FormatError, DbtyperError } from "../dbtyper-error.ts"

const tokenKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way
const restKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

export type ParseSqlTokens<S extends string = string> = [ReadTokenFromString<S>] extends [
	infer Result extends TokensList,
]
	? Result
	: never

export type EmptyTokenList = ParseSqlTokens<"">
export type TokenKind = "ident" | "string" | "number" | "key" | "param" | "eot"
export type TokenType<Kind extends TokenKind, Value extends string = ""> = { value: Value; kind: Kind }
export type TokenKey<Key extends string> = TokenType<"key", Key>
export type TokenIdent<Ident extends string> = TokenType<"ident", Ident>
export type TokenString<String extends string> = TokenType<"string", String>
export type TokenNumber<Num extends string> = TokenType<"number", Num>
export type TokenParam<Param extends string> = TokenType<"param", Param>
export type TokenEot = TokenType<"eot">

/** Lexeme head: a normal token, or a lexical failure. */
type TokenStreamHead = TokenType<TokenKind, string> | DbtyperError<any, any>

export type TokensList = Buffer<TokenStreamHead, string>

export type PeekToken<Tokens extends TokensList> = Tokens[typeof tokenKey]
export type SkipToken<Tokens extends TokensList> = ParseSqlTokens<Tokens[typeof restKey]>

type Buffer<Token extends TokenStreamHead, Rest extends string> = {
	[tokenKey]: Token
	[restKey]: Rest
}

/** Lex one token from a string (internal) */
type ReadTokenFromString<S extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends StartTokenChar
		? ReadTokenChars<Rest> extends {
				token: infer Word extends string
				rest: infer Tail extends string
			}
			? Buffer<CheckIdentOrKey<Lowercase<`${Head}${Word}`>>, Tail>
			: never
		: Head extends "/"
			? Rest extends `*${string}`
				? ReadTokenFromString<SkipSpaces<S>>
				: ReadOperator<S>
			: Head extends "-"
				? Rest extends `-${string}`
					? ReadTokenFromString<SkipSpaces<S>>
					: ReadOperator<S>
				: Head extends OperatorChars
					? ReadOperator<S>
					: Head extends Digit
						? GetNumber<Rest, Head>
						: Head extends "."
							? Rest extends `${infer Second}${infer Rest2}`
								? Second extends Digit
									? GetNumberFrac<Rest2, `${Head}${Second}`>
									: Buffer<TokenKey<".">, Rest>
								: Buffer<TokenKey<".">, Rest>
							: Head extends '"'
								? Rest extends `${infer String}"${infer Rest}`
									? Buffer<TokenIdent<String>, Rest>
									: Buffer<FormatError<"UNCLOSED_QUOTED_IDENTIFIER", []>, S>
								: Head extends "\x20" | "\n" | "\r" | "\t"
									? ReadTokenFromString<SkipSpaces<Rest>>
									: Head extends "'"
										? ReadSingleQuotedString<Rest>
										: Head extends ":"
											? Rest extends `${infer Next}${infer Rest2}`
												? Next extends ":"
													? Buffer<TokenKey<"::">, Rest2>
													: Next extends TokenChar
														? ReadTokenChars<Rest2> extends {
																token: infer Token extends string
																rest: infer Rest3 extends string
															}
															? Buffer<TokenParam<`${Next}${Token}`>, Rest3>
															: never
														: Buffer<TokenKey<":">, Rest>
												: Buffer<TokenKey<":">, Rest>
											: Head extends "$"
												? ReadDollar<Rest>
												: Buffer<TokenKey<Head>, Rest>
	: Buffer<TokenEot, "">

type ReadDollar<S extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends "$"
		? Rest extends `${infer String}$$${infer Rest2}`
			? Buffer<TokenString<String>, Rest2>
			: Buffer<FormatError<"UNCLOSED_TAGGED_STRING", []>, S>
		: Head extends StartTokenChar
			? Rest extends `${infer Tag}$${infer Rest2}`
				? ReadTokenChars<Tag> extends { rest: "" }
					? Rest2 extends `${infer String}$${Head}${Tag}$${infer Rest3}`
						? Buffer<TokenString<String>, Rest3>
						: Buffer<FormatError<"UNCLOSED_TAGGED_STRING", []>, S>
					: Buffer<FormatError<"WRONG_STRING_TAG", []>, S>
				: Buffer<FormatError<"WRONG_STRING_TAG", []>, S>
			: Buffer<FormatError<"WRONG_STRING_TAG", []>, S>
	: Buffer<FormatError<"WRONG_STRING_TAG", []>, S>

type ReadSingleQuotedString<S extends string> = S extends `${infer P1}'${infer R1}`
	? R1 extends `'${infer R2}`
		? ReadSingleQuotedString<R2> extends Buffer<TokenString<infer P2 extends string>, infer R3 extends string>
			? Buffer<TokenString<`${P1}'${P2}`>, R3>
			: Buffer<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>
		: SkipSpaces<R1> extends infer R4 extends string
			? R4 extends `'${infer R5}`
				? ReadSingleQuotedString<R5> extends Buffer<
						TokenString<infer P6 extends string>,
						infer R6 extends string
					>
					? Buffer<TokenString<`${P1}${P6}`>, R6>
					: Buffer<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>
				: Buffer<TokenString<P1>, R4>
			: never
	: Buffer<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>

type CheckIdentOrKey<S extends string> = S extends ServiceWords ? TokenKey<S> : TokenIdent<S>

type ReadTokenChars<S extends string, Chars = TokenChar> = OptimizedBySpaceReadTokenChars<S, Chars>

type OptimizedBySpaceReadTokenChars<
	S extends string,
	Chars = TokenChar,
> = S extends `${infer SmallerBuffer}\x20${infer Rest extends string}`
	? ReadTokenCharsRaw<SmallerBuffer, Chars> extends {
			token: infer T extends string
			rest: infer SmallerRest extends string
		}
		? SmallerRest extends ""
			? { token: T; rest: Rest }
			: S extends `${T}${infer Rest2}`
				? { token: T; rest: Rest2 }
				: never
		: ReadTokenCharsRaw<S, Chars>
	: ReadTokenCharsRaw<S, Chars>

type ReadTokenCharsRaw<
	S extends string,
	Chars = TokenChar,
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends Chars
		? ReadTokenCharsRaw<Rest, Chars, `${Acc}${C}`>
		: { token: Acc; rest: S }
	: { token: Acc; rest: "" }

type OperatorChars = PlusMinus | NarrowOperatorChars | WideOperatorChars
type PlusMinus = "+" | "-"
type NarrowOperatorChars = "*" | "/" | "<" | ">" | "="
type WideOperatorChars = "~" | "!" | "@" | "#" | "%" | "^" | "&" | "|" | "`" | "?"

type ReadOperator<S extends string> =
	OptimizedBySpaceReadOperatorChars<S> extends { token: infer Word extends string; rest: infer Tail extends string }
		? Word extends `${infer Before}--${string}`
			? S extends `${Before}${infer Rest}`
				? Buffer<TokenKey<Before>, Rest>
				: never
			: Word extends `${infer Before}/*${string}`
				? S extends `${Before}${infer Rest}`
					? Buffer<TokenKey<Before>, Rest>
					: never
				: Buffer<TokenKey<Word>, Tail>
		: never

type OptimizedBySpaceReadOperatorChars<S extends string> =
	S extends `${infer SmallerBuffer}\x20${infer Rest extends string}`
		? ReadOperatorChars<SmallerBuffer> extends {
				token: infer T extends string
				rest: infer SmallerRest extends string
			}
			? SmallerRest extends ""
				? { token: T; rest: Rest }
				: S extends `${T}${infer Rest2}`
					? { token: T; rest: Rest2 }
					: never
			: ReadOperatorChars<S>
		: ReadOperatorChars<S>

type ReadOperatorChars<
	S extends string,
	Op extends string = "",
	SNarrow extends string = S,
	OpNarrow extends string = Op,
> = S extends `${infer C}${infer Rest}`
	? C extends WideOperatorChars
		? ReadOperatorCharsWide<Rest, `${Op}${C}`>
		: C extends NarrowOperatorChars
			? ReadOperatorChars<Rest, `${Op}${C}`, Rest, `${Op}${C}`>
			: C extends PlusMinus
				? Op extends ""
					? ReadOperatorChars<Rest, C, Rest, C>
					: ReadOperatorChars<Rest, `${Op}${C}`, SNarrow, OpNarrow>
				: { token: OpNarrow; rest: SNarrow }
	: { token: OpNarrow; rest: SNarrow }

type ReadOperatorCharsWide<S extends string, Op extends string> = S extends `${infer C}${infer Rest}`
	? C extends OperatorChars
		? ReadOperatorCharsWide<Rest, `${Op}${C}`>
		: { token: Op; rest: S }
	: { token: Op; rest: S }

type SkipSpaces<S> =
	SkipSomeSpaces<S> extends [infer R extends string, infer HasMoreSpace]
		? HasMoreSpace extends true
			? SkipSpaces<R>
			: R
		: never

type SkipSomeSpaces<S, Acc extends unknown[] = []> = Acc["length"] extends 100
	? [S, true]
	: S extends `\x20${infer Rest}`
		? SkipSomeSpaces<Rest, [...Acc, 1]>
		: S extends `\n${infer Rest}`
			? SkipSomeSpaces<Rest, [...Acc, 1]>
			: S extends `\t${infer Rest}`
				? SkipSomeSpaces<Rest, [...Acc, 1]>
				: S extends `\r${infer Rest}`
					? SkipSomeSpaces<Rest, [...Acc, 1]>
					: S extends `--${infer Comment}`
						? Comment extends `${string}\n${infer Rest}`
							? SkipSomeSpaces<Rest, [...Acc, 1]>
							: ["", false]
						: S extends `/*${infer Comment}`
							? SkipSomeSpaces<SkipMultiComment<Comment>, [...Acc, 1]>
							: [S, false]

type StartTokenChar = Letter | "_"

type TokenChar = Letter | Digit | "_"

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

type Letter = LowerCaseLetter | UpperCaseLetter

type UpperCaseLetter = Uppercase<LowerCaseLetter>

type LowerCaseLetter =
	| "a"
	| "b"
	| "c"
	| "d"
	| "e"
	| "f"
	| "g"
	| "h"
	| "i"
	| "j"
	| "k"
	| "l"
	| "m"
	| "n"
	| "o"
	| "p"
	| "q"
	| "r"
	| "s"
	| "t"
	| "u"
	| "v"
	| "w"
	| "x"
	| "y"
	| "z"

const serviceWordsMap = {
	add: true,
	all: true,
	alter: true,
	always: true,
	and: true,
	any: true,
	as: true,
	asc: true,
	begin: true,
	between: true,
	by: true,
	case: true,
	cast: true,
	check: true,
	column: true,
	conflict: true,
	constraint: true,
	create: true,
	cross: true,
	current_date: true,
	current_time: true,
	current_timestamp: true,
	database: true,
	declare: true,
	default: true,
	delete: true,
	else: true,
	enum: true,
	desc: true,
	distinct: true,
	do: true,
	drop: true,
	end: true,
	except: true,
	exclude: true,
	exists: true,
	false: true,
	fetch: true,
	first: true,
	foreign: true,
	from: true,
	full: true,
	function: true,
	generated: true,
	group: true,
	having: true,
	if: true,
	in: true,
	index: true,
	inner: true,
	insert: true,
	intersect: true,
	into: true,
	is: true,
	join: true,
	key: true,
	ilike: true,
	language: true,
	left: true,
	like: true,
	limit: true,
	natural: true,
	array: true,
	next: true,
	not: true,
	null: true,
	offset: true,
	on: true,
	only: true,
	or: true,
	order: true,
	outer: true,
	over: true,
	partition: true,
	primary: true,
	references: true,
	rename: true,
	replace: true,
	return: true,
	returning: true,
	returns: true,
	right: true,
	row: true,
	rows: true,
	schema: true,
	select: true,
	set: true,
	some: true,
	stored: true,
	table: true,
	then: true,
	to: true,
	true: true,
	type: true,
	union: true,
	unique: true,
	update: true,
	use: true,
	using: true,
	values: true,
	virtual: true,
	view: true,
	when: true,
	where: true,
}

export type ServiceWords = keyof typeof serviceWordsMap

export const serviceWords: ReadonlySet<string> = new Set(Object.keys(serviceWordsMap))

type SkipMultiComment<S extends string> = S extends `${infer Comment}*/${infer Rest}`
	? Comment extends `${string}/*${string}`
		? Skip2Comments<S>
		: Comment extends `${string}/`
			? Skip2Comments<S>
			: Rest
	: ""

type Skip2Comments<S extends string> = S extends `${string}/*${infer Rest}`
	? SkipMultiComment<SkipMultiComment<Rest>>
	: never

type GetNumber<S extends string, Num extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumber<Rest, `${Num}${D1}`>
		: D1 extends "."
			? GetNumberFrac<Rest, `${Num}${D1}`>
			: D1 extends "e" | "E"
				? GetNumberExpStart<Rest, `${Num}${D1}`>
				: D1 extends Letter
					? Buffer<FormatError<"INVALID_NUMBER", []>, S>
					: Buffer<TokenNumber<Num>, S>
	: Buffer<TokenNumber<Num>, S>

type GetNumberFrac<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberFrac<Rest, `${Buf}${D1}`>
		: D1 extends "e" | "E"
			? GetNumberExpStart<Rest, `${Buf}${D1}`>
			: D1 extends Letter
				? Buffer<FormatError<"INVALID_NUMBER", []>, S>
				: Buffer<TokenNumber<Buf>, S>
	: Buffer<TokenNumber<Buf>, S>

type GetNumberExpStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends "+" | "-"
		? GetNumberExpNumStart<Rest, `${Buf}${D1}`>
		: D1 extends Digit
			? GetNumberExpNum<Rest, `${Buf}${D1}`>
			: Buffer<FormatError<"INVALID_NUMBER", []>, S>
	: Buffer<FormatError<"INVALID_NUMBER", []>, S>

type GetNumberExpNumStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: Buffer<FormatError<"INVALID_NUMBER", []>, S>
	: Buffer<FormatError<"INVALID_NUMBER", []>, S>

type GetNumberExpNum<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: D1 extends Letter
			? Buffer<FormatError<"INVALID_NUMBER", []>, S>
			: Buffer<TokenNumber<Buf>, S>
	: Buffer<TokenNumber<Buf>, S>
