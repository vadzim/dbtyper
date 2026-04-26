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
export type TokensList = MakeTokensBuffer<TokenType<TokenKind, string>, string>
export type SqlParserError<Message extends string> = {
	__sql_parser_error__: Message
}

export type PeekToken<Tokens extends TokensList> = Tokens[typeof tokenKey]
export type SkipToken<Tokens extends TokensList> = ParseSqlTokens<Tokens[typeof restKey]>
export type ReadToken<Tokens extends TokensList> = [SkipToken<Tokens>, PeekToken<Tokens>]

type MakeTokensBuffer<Token extends TokenType<TokenKind, string>, Rest extends string> = {
	[tokenKey]: Token
	[restKey]: Rest
}

/** Lex one token from a string (internal) */
type ReadTokenFromString<S extends string> = S extends `${Ws}${infer Rest}`
	? ReadTokenFromString<Rest>
	: S extends `"${infer String}"${infer Rest}`
		? MakeTokensBuffer<TokenIdent<String>, Rest>
		: S extends `'${infer String}'${infer Rest}`
			? MakeTokensBuffer<TokenString<String>, Rest>
			: S extends `$$${infer String}$$${infer Rest}`
				? MakeTokensBuffer<TokenString<String>, Rest>
				: ReadTaggedDollar<S> extends {
							__token__: infer String extends string
							__rest__: infer Rest extends string
					  }
					? MakeTokensBuffer<TokenString<String>, Rest>
					: S extends `\`${infer String}\`${infer Rest}`
						? MakeTokensBuffer<TokenIdent<String>, Rest>
						: S extends `--${infer Comment}`
							? Comment extends `${string}\n${infer Rest}`
								? ReadTokenFromString<Rest>
								: MakeTokensBuffer<TokenEot, "">
							: S extends `/*${infer Comment}`
								? Comment extends `${string}*/${infer Rest}`
									? ReadTokenFromString<Rest>
									: MakeTokensBuffer<TokenEot, "">
								: S extends `${infer Head}${infer Rest}`
									? Head extends StartTokenChar
										? OptimizedBySpaceReadTokenChars<Rest> extends {
												__token__: infer Word extends string
												__rest__: infer Tail extends string
											}
											? MakeTokensBuffer<CheckDoubleQuotes<Lowercase<`${Head}${Word}`>>, Tail>
											: MakeTokensBuffer<TokenKey<Head>, Rest>
										: MakeTokensBuffer<TokenKey<Head>, Rest>
									: MakeTokensBuffer<TokenEot, "">

type ReadTaggedDollar<S extends string> = S extends `$${infer Tag}$${infer Rest}`
	? ReadTokenChars<Tag>["__rest__"] extends ""
		? Rest extends `${infer String}$${Tag}$${infer Rest2}`
			? { __token__: String; __rest__: Rest2 }
			: { __token__: Rest; __rest__: "" }
		: null
	: null

type CheckDoubleQuotes<S extends string> = S extends ServiceWords
	? TokenKey<S>
	: S extends `${number}`
		? TokenKey<S>
		: TokenIdent<S>

type OptimizedBySpaceReadTokenChars<S extends string> =
	S extends `${infer SmallerBuffer}\x20${infer Rest extends string}`
		? ReadTokenChars<SmallerBuffer> extends {
				__token__: infer T extends string
				__rest__: infer SmallerRest extends string
			}
			? SmallerRest extends ""
				? { __token__: T; __rest__: Rest }
				: { __token__: T; __rest__: `${SmallerRest}\x20${Rest}` }
			: ReadTokenChars<S>
		: ReadTokenChars<S>

type ReadTokenChars<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends TokenChar
		? ReadTokenChars<Rest, `${Acc}${C}`>
		: { __token__: Acc; __rest__: S }
	: { __token__: Acc; __rest__: "" }

type Ws = "\x20" | "\n" | "\t" | "\r"

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

type ServiceWords = keyof {
	add: true
	alter: true
	and: true
	"=": true
	as: true
	always: true
	asc: true
	begin: true
	by: true
	check: true
	column: true
	constraint: true
	current_date: true
	current_time: true
	current_timestamp: true
	create: true
	cross: true
	database: true
	declare: true
	default: true
	desc: true
	delete: true
	distinct: true
	drop: true
	end: true
	exclude: true
	exists: true
	false: true
	foreign: true
	from: true
	full: true
	function: true
	generated: true
	group: true
	having: true
	if: true
	in: true
	index: true
	inner: true
	insert: true
	into: true
	join: true
	key: true
	language: true
	left: true
	limit: true
	natural: true
	not: true
	now: true
	null: true
	offset: true
	on: true
	only: true
	or: true
	order: true
	outer: true
	primary: true
	references: true
	rename: true
	replace: true
	return: true
	returning: true
	returns: true
	right: true
	schema: true
	stored: true
	select: true
	set: true
	table: true
	to: true
	true: true
	virtual: true
	unique: true
	use: true
	using: true
	values: true
	where: true
}
