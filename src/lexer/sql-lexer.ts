import type { DbtyperErrorShape, E, FormatError } from "../dbtyper-error.ts"

export type LexerFeatures = "" | "dollar-strings" | "named-params" | "indexed-params"

export type TokenKind = "ident" | "string" | "number" | "key" | "param" | "indexed_param" | "eot"

export type TokenType<Kind extends TokenKind, Value extends string | number = ""> = { value: Value; kind: Kind }

export type TokenKey<Key extends string> = TokenType<"key", Key>
export type TokenIdent<Ident extends string> = TokenType<"ident", Ident>
export type TokenString<String extends string> = TokenType<"string", String>
export type TokenNumber<Num extends string> = TokenType<"number", Num>
export type TokenParam<Param extends string> = TokenType<"param", Param>
export type TokenIndexedParam<Index extends string> = TokenType<"indexed_param", Index>
export type TokenEot = TokenType<"eot">

export type TokenStreamHead = TokenType<TokenKind, string> | DbtyperErrorShape

/** Lex one token from a string (internal) */
export type ReadTokenFromString<S extends string, Syntax extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends StartTokenChar
		? ReadTokenChars<Rest> extends {
				token: infer Word extends string
				rest: infer Tail extends string
			}
			? Return<CheckIdentOrKey<Lowercase<`${Head}${Word}`>>, Tail>
			: never
		: Head extends "/"
			? Rest extends `*${string}`
				? ReadTokenFromString<SkipSpaces<S>, Syntax>
				: ReadOperator<S>
			: Head extends "-"
				? Rest extends `-${string}`
					? ReadTokenFromString<SkipSpaces<S>, Syntax>
					: ReadOperator<S>
				: Head extends OperatorChars
					? ReadOperator<S>
					: Head extends Digit
						? GetNumber<Rest, Head>
						: Head extends "."
							? Rest extends `${infer Second}${infer Rest2}`
								? Second extends Digit
									? GetNumberFrac<Rest2, `${Head}${Second}`>
									: Return<TokenKey<".">, Rest>
								: Return<TokenKey<".">, Rest>
							: Head extends '"'
								? Rest extends `${infer String}"${infer Rest}`
									? Return<TokenIdent<String>, Rest>
									: Return<FormatError<E["UNCLOSED_QUOTED_IDENTIFIER"], []>, S>
								: Head extends "\x20" | "\n" | "\r" | "\t"
									? ReadTokenFromString<SkipSpaces<Rest>, Syntax>
									: Head extends "'"
										? ReadSingleQuotedString<Rest>
										: Head extends ":"
											? Rest extends `${infer Next}${infer Rest2}`
												? Next extends ":"
													? Return<TokenKey<"::">, Rest2>
													: Next extends TokenChar
														? "named-params" extends Syntax
															? ReadTokenChars<Rest2> extends {
																	token: infer Token extends string
																	rest: infer Rest3 extends string
																}
																? Return<TokenParam<`${Next}${Token}`>, Rest3>
																: never
															: Return<TokenKey<":">, Rest>
														: Return<TokenKey<":">, Rest>
												: Return<TokenKey<":">, Rest>
											: Head extends "$"
												? Rest extends `${infer Next}${infer Rest2}`
													? Next extends "$" | StartTokenChar
														? "dollar-strings" extends Syntax
															? ReadDollarString<Rest>
															: Return<FormatError<"UNEXPECTED_TOKEN", []>, S>
														: Next extends NonZeroDigit
															? "indexed-params" extends Syntax
																? ReadIndexedParam<Next, Rest2>
																: Return<FormatError<"UNEXPECTED_TOKEN", []>, S>
															: Return<FormatError<"UNEXPECTED_TOKEN", []>, S>
													: Return<FormatError<"UNEXPECTED_TOKEN", []>, S>
												: Return<TokenKey<Head>, Rest>
	: Return<TokenEot, "">

type Return<Result, Rest> = [Result, Rest]

type ReadIndexedParam<Head extends string, Rest extends string> =
	GetIndexingNumber<Head, Rest> extends Return<infer Index extends TokenNumber<string>, infer Rest2 extends string>
		? Return<TokenIndexedParam<Index["value"]>, Rest2>
		: Return<
				FormatError<
					"INVALID_INDEXED_PARAM",
					[`$${Head}${ReadTokenChars<Rest, TokenChar | "." | "+" | "-">["token"]}`]
				>,
				Rest
			>

type GetIndexingNumber<Head extends string, Rest extends string> =
	GetNumber<Rest, Head> extends Return<infer Number extends TokenNumber<string>, infer Rest2 extends string>
		? IsIndexingNumber<Number["value"]> extends true
			? Return<Number, Rest2>
			: Return<FormatError<"UNEXPECTED_TOKEN", []>, Rest>
		: Return<FormatError<"UNEXPECTED_TOKEN", []>, Rest>

type IsIndexingNumber<S extends string> = S extends `${string}.${string}`
	? false
	: S extends `${string}+${string}`
		? false
		: S extends `${string}-${string}`
			? false
			: S extends `${string}e${string}`
				? false
				: S extends `${string}E${string}`
					? false
					: S extends `${string}_${string}`
						? false
						: S extends `0${string}`
							? false
							: true

type ReadDollarString<S extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends "$"
		? Rest extends `${infer String}$$${infer Rest2}`
			? Return<TokenString<String>, Rest2>
			: Return<FormatError<"UNCLOSED_TAGGED_STRING", []>, S>
		: Head extends StartTokenChar
			? Rest extends `${infer Tag}$${infer Rest2}`
				? ReadTokenChars<Tag> extends { rest: "" }
					? Rest2 extends `${infer String}$${Head}${Tag}$${infer Rest3}`
						? Return<TokenString<String>, Rest3>
						: Return<FormatError<"UNCLOSED_TAGGED_STRING", []>, S>
					: Return<FormatError<"WRONG_STRING_TAG", []>, S>
				: Return<FormatError<"WRONG_STRING_TAG", []>, S>
			: Return<FormatError<"WRONG_STRING_TAG", []>, S>
	: Return<FormatError<"WRONG_STRING_TAG", []>, S>

type ReadSingleQuotedString<S extends string> = S extends `${infer P1}'${infer R1}`
	? R1 extends `'${infer R2}`
		? ReadSingleQuotedString<R2> extends Return<TokenString<infer P2 extends string>, infer R3 extends string>
			? Return<TokenString<`${P1}'${P2}`>, R3>
			: Return<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>
		: SkipSpaces<R1> extends infer R4 extends string
			? R4 extends `'${infer R5}`
				? ReadSingleQuotedString<R5> extends Return<
						TokenString<infer P6 extends string>,
						infer R6 extends string
					>
					? Return<TokenString<`${P1}${P6}`>, R6>
					: Return<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>
				: Return<TokenString<P1>, R4>
			: never
	: Return<FormatError<"UNCLOSED_STRING_LITERAL", []>, S>

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
				? Return<TokenKey<Before>, Rest>
				: never
			: Word extends `${infer Before}/*${string}`
				? S extends `${Before}${infer Rest}`
					? Return<TokenKey<Before>, Rest>
					: never
				: Return<TokenKey<Word>, Tail>
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

type NonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

type Digit = "0" | NonZeroDigit

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
					? Return<FormatError<"INVALID_NUMBER", []>, S>
					: Return<TokenNumber<Num>, S>
	: Return<TokenNumber<Num>, S>

type GetNumberFrac<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberFrac<Rest, `${Buf}${D1}`>
		: D1 extends "e" | "E"
			? GetNumberExpStart<Rest, `${Buf}${D1}`>
			: D1 extends Letter
				? Return<FormatError<"INVALID_NUMBER", []>, S>
				: Return<TokenNumber<Buf>, S>
	: Return<TokenNumber<Buf>, S>

type GetNumberExpStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends "+" | "-"
		? GetNumberExpNumStart<Rest, `${Buf}${D1}`>
		: D1 extends Digit
			? GetNumberExpNum<Rest, `${Buf}${D1}`>
			: Return<FormatError<"INVALID_NUMBER", []>, S>
	: Return<FormatError<"INVALID_NUMBER", []>, S>

type GetNumberExpNumStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: Return<FormatError<"INVALID_NUMBER", []>, S>
	: Return<FormatError<"INVALID_NUMBER", []>, S>

type GetNumberExpNum<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: D1 extends Letter
			? Return<FormatError<"INVALID_NUMBER", []>, S>
			: Return<TokenNumber<Buf>, S>
	: Return<TokenNumber<Buf>, S>
