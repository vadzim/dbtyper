const tokenKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way
const restKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

export type ParseSqlTokens<S extends string = string> = [ReadTokenFromString<S>] extends [
	infer Result extends TokensList,
]
	? Result
	: never

export type EmptyTokenList = ParseSqlTokens<"">
export type TokenKind = "ident" | "string" | "key" | "eot"
export type TokenType<Kind extends TokenKind, Value extends string = ""> = { value: Value; kind: Kind }
export type TokenKey<Key extends string> = TokenType<"key", Key>
export type TokenIdent<Ident extends string> = TokenType<"ident", Ident>
export type TokenString<String extends string> = TokenType<"string", String>
export type TokenEot = TokenType<"eot">
export type TokensList = Buffer<TokenType<TokenKind, string>, string>
export type SqlParserError<Message extends string> = {
	__sql_parser_error__: Message
}

export type PeekToken<Tokens extends TokensList> = Tokens[typeof tokenKey]
export type SkipToken<Tokens extends TokensList> = ParseSqlTokens<Tokens[typeof restKey]>
export type ReadToken<Tokens extends TokensList> = [SkipToken<Tokens>, PeekToken<Tokens>]

type Buffer<Token extends TokenType<TokenKind, string>, Rest extends string> = {
	[tokenKey]: Token
	[restKey]: Rest
}

/** Lex one token from a string (internal) */
type ReadTokenFromString<S extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends StartTokenChar
		? OptimizedBySpaceReadTokenChars<Rest> extends {
				token: infer Word extends string
				rest: infer Tail extends string
			}
			? Buffer<CheckDoubleQuotes<Lowercase<`${Head}${Word}`>>, Tail>
			: Buffer<TokenKey<Head>, Rest>
		: Head extends '"'
			? Rest extends `${infer String}"${infer Rest}`
				? Buffer<TokenIdent<String>, Rest>
				: Buffer<TokenIdent<Rest>, "">
			: Head extends "\x20" | "\n" | "\r" | "\t"
				? ReadTokenFromString<SkipSpaces<Rest>>
				: Head extends "'"
					? ReadSingleQuotedString<Rest>
					: Head extends "<"
						? Rest extends `>${infer Rest}`
							? Buffer<TokenKey<"<>">, Rest>
							: Rest extends `=${infer Rest}`
								? Buffer<TokenKey<"<=">, Rest>
								: Rest extends `@${infer Rest}`
									? Buffer<TokenKey<"<@">, Rest>
									: Buffer<TokenKey<"<">, Rest>
						: Head extends ">"
							? Rest extends `=${infer Rest}`
								? Buffer<TokenKey<">=">, Rest>
								: Buffer<TokenKey<">">, Rest>
							: Head extends "!"
								? Rest extends `=${infer Rest}`
									? Buffer<TokenKey<"!=">, Rest>
									: Rest extends `~*${infer Rest}`
										? Buffer<TokenKey<"!~*">, Rest>
										: Rest extends `~~${infer Rest}`
											? Buffer<TokenKey<"!~~">, Rest>
											: Rest extends `~${infer Rest}`
												? Buffer<TokenKey<"!~">, Rest>
												: Buffer<TokenKey<"!">, Rest>
								: Head extends "|"
									? Rest extends `|${infer Rest}`
										? Buffer<TokenKey<"||">, Rest>
										: Buffer<TokenKey<"|">, Rest>
									: Head extends ":"
										? Rest extends `:${infer Rest}`
											? Buffer<TokenKey<"::">, Rest>
											: Buffer<TokenKey<":">, Rest>
										: Head extends "#"
											? Rest extends `>>${infer Rest}`
												? Buffer<TokenKey<"#>>">, Rest>
												: Rest extends `>${infer Rest}`
													? Buffer<TokenKey<"#>">, Rest>
													: Buffer<TokenKey<"#">, Rest>
											: Head extends "-"
												? Rest extends `>>${infer Rest}`
													? Buffer<TokenKey<"->>">, Rest>
													: Rest extends `>${infer Rest}`
														? Buffer<TokenKey<"->">, Rest>
														: Rest extends `-${string}`
															? ReadTokenFromString<SkipSpaces<S>>
															: Buffer<TokenKey<"-">, Rest>
												: Head extends "~"
													? Rest extends `~${infer Rest}`
														? Buffer<TokenKey<"~~">, Rest>
														: Rest extends `*${infer Rest}`
															? Buffer<TokenKey<"~*">, Rest>
															: Buffer<TokenKey<"~">, Rest>
													: Head extends "@"
														? Rest extends `>${infer Rest}`
															? Buffer<TokenKey<"@>">, Rest>
															: Buffer<TokenKey<"@">, Rest>
														: Head extends "&"
															? Rest extends `&${infer Rest}`
																? Buffer<TokenKey<"&&">, Rest>
																: Buffer<TokenKey<"&">, Rest>
															: Head extends "/"
																? Rest extends `*${infer Rest}`
																	? ReadTokenFromString<
																			SkipSpaces<SkipMultiComment<Rest>>
																		>
																	: Buffer<TokenKey<"/">, Rest>
																: Head extends "$"
																	? S extends `$$${infer String}$$${infer Rest}`
																		? Buffer<TokenString<String>, Rest>
																		: ReadTaggedDollar<S> extends {
																					token: infer String extends string
																					rest: infer Rest extends string
																			  }
																			? Buffer<TokenString<String>, Rest>
																			: Buffer<TokenKey<"$">, Rest>
																	: Buffer<TokenKey<Head>, Rest>
	: Buffer<TokenEot, "">

type ReadTaggedDollar<S> = S extends `$${infer Tag}$${infer Rest}`
	? ReadTokenChars<Tag>["rest"] extends ""
		? Rest extends `${infer String}$${Tag}$${infer Rest2}`
			? { token: String; rest: Rest2 }
			: { token: Rest; rest: "" }
		: null
	: null

type ReadSingleQuotedString<S extends string> = S extends `${infer P1}'${infer R1}`
	? R1 extends `'${infer R2}`
		? ReadSingleQuotedString<R2> extends Buffer<TokenString<infer P2 extends string>, infer R3 extends string>
			? Buffer<TokenString<`${P1}'${P2}`>, R3>
			: never
		: SkipSpaces<R1> extends infer R4 extends string
			? R4 extends `'${infer R5}`
				? ReadSingleQuotedString<R5> extends Buffer<
						TokenString<infer P6 extends string>,
						infer R6 extends string
					>
					? Buffer<TokenString<`${P1}${P6}`>, R6>
					: never
				: Buffer<TokenString<P1>, R4>
			: never
	: Buffer<TokenString<S>, "">

type CheckDoubleQuotes<S extends string> = S extends ServiceWords
	? TokenKey<S>
	: S extends `${number}`
		? TokenKey<S>
		: TokenIdent<S>

type OptimizedBySpaceReadTokenChars<S extends string> =
	S extends `${infer SmallerBuffer}\x20${infer Rest extends string}`
		? ReadTokenChars<SmallerBuffer> extends {
				token: infer T extends string
				rest: infer SmallerRest extends string
			}
			? SmallerRest extends ""
				? { token: T; rest: Rest }
				: { token: T; rest: `${SmallerRest}\x20${Rest}` }
			: ReadTokenChars<S>
		: ReadTokenChars<S>

type ReadTokenChars<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends TokenChar
		? ReadTokenChars<Rest, `${Acc}${C}`>
		: { token: Acc; rest: S }
	: { token: Acc; rest: "" }

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

type StartTokenChar = Letter | Digit | "_"

type TokenChar = Letter | Digit | "$" | "_"

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
	alter: true,
	always: true,
	and: true,
	as: true,
	asc: true,
	begin: true,
	by: true,
	check: true,
	column: true,
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
	desc: true,
	distinct: true,
	drop: true,
	end: true,
	except: true,
	exclude: true,
	exists: true,
	false: true,
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
	join: true,
	key: true,
	language: true,
	left: true,
	limit: true,
	natural: true,
	not: true,
	now: true,
	null: true,
	offset: true,
	on: true,
	only: true,
	or: true,
	order: true,
	outer: true,
	primary: true,
	references: true,
	rename: true,
	replace: true,
	return: true,
	returning: true,
	returns: true,
	right: true,
	schema: true,
	select: true,
	set: true,
	stored: true,
	table: true,
	to: true,
	true: true,
	union: true,
	unique: true,
	use: true,
	using: true,
	values: true,
	virtual: true,
	where: true,
}

export type ServiceWords = keyof typeof serviceWordsMap

export const serviceWords: ReadonlySet<string> = new Set(Object.keys(serviceWordsMap))

type SkipMultiComment<S extends string> = S extends `${infer Comment}*/${infer Rest}`
	? Comment extends `${string}/*${string}`
		? S extends `${string}/*${infer Rest2}`
			? SkipMultiComment<SkipMultiComment<Rest2>>
			: never
		: Comment extends `${string}/`
			? S extends `${string}/*${infer Rest2}`
				? SkipMultiComment<SkipMultiComment<Rest2>>
				: never
			: Rest
	: ""
