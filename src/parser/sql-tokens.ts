// const bufferKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way
// type BufferKey = typeof bufferKey // it's denied to export this type and use it outside this module in any directional or indirectional way

export type InitBuffer<S extends string = string> = { __buffer__: S } // opaque buffer type
export type EmptyBuffer = { __buffer__: "" }
export type BufferLike = { __buffer__: string }
export type BufferPayload<B extends BufferLike> = B["__buffer__"] // will be removed in the future

export type SqlParseError<Message extends string> = {
	readonly __sql_parse_error__: Message
}

export type ReadToken<B extends BufferLike> =
	ReadTokenFromString<B["__buffer__"]> extends {
		__token__: infer Token extends string
		__rest__: infer Rest extends string
		__buffer__: string
	}
		? [Token, InitBuffer<Rest>]
		: never

/** Lex one token from a string (internal). `__buffer__` is always `S` for this call (debug). */
type ReadTokenFromString<S extends string> = S extends `${Ws}${infer Rest}`
	? ReadTokenFromString<Rest>
	: S extends `"${infer String}"${infer Rest}`
		? { __token__: `"${String}"`; __rest__: Rest; __buffer__: S }
		: S extends `'${infer String}'${infer Rest}`
			? { __token__: `'${String}'`; __rest__: Rest; __buffer__: S }
			: S extends `\`${infer String}\`${infer Rest}`
				? { __token__: `\`${String}\``; __rest__: Rest; __buffer__: S }
				: S extends `[${infer String}]${infer Rest}`
					? { __token__: String; __rest__: Rest; __buffer__: S }
					: S extends `--${infer Comment}`
						? Comment extends `${string}\n${infer Rest}`
							? ReadTokenFromString<Rest>
							: { __token__: ""; __rest__: ""; __buffer__: S }
						: S extends `/*${infer Comment}`
							? Comment extends `${string}*/${infer Rest}`
								? ReadTokenFromString<Rest>
								: { __token__: ""; __rest__: ""; __buffer__: S }
							: S extends `${infer Head}${infer Rest}`
								? Head extends StartTokenChar
									? OptimizedBySpaceReadTokenChars<Rest> extends {
											__token__: infer Word extends string
											__rest__: infer Tail extends string
										}
										? {
												__token__: CheckDoubleQuotes<Lowercase<`${Head}${Word}`>>
												__rest__: Tail
												__buffer__: S
											}
										: { __token__: Head; __rest__: Rest; __buffer__: S }
									: { __token__: Head; __rest__: Rest; __buffer__: S }
								: { __token__: S; __rest__: ""; __buffer__: S }

type CheckDoubleQuotes<S extends string> = S extends ServiceWords ? S : `"${S}"`

type OptimizedBySpaceReadTokenChars2<S extends string> = S extends `${infer SmallerBuffer} ${string}`
	? ReadTokenChars<SmallerBuffer> extends { __token__: infer T extends string; __rest__: string }
		? S extends `${T}${infer Rest}`
			? { __token__: T; __rest__: Rest }
			: ReadTokenChars<S>
		: ReadTokenChars<S>
	: ReadTokenChars<S>

type OptimizedBySpaceReadTokenChars<S extends string> = S extends `${infer SmallerBuffer} ${infer Rest extends string}`
	? ReadTokenChars<SmallerBuffer> extends {
			__token__: infer T extends string
			__rest__: infer SmallerRest extends string
		}
		? SmallerRest extends ""
			? { __token__: T; __rest__: Rest }
			: { __token__: T; __rest__: `${SmallerRest} ${Rest}` }
		: ReadTokenChars<S>
	: ReadTokenChars<S>

// type ReadTokenChars<R0 extends string, Acc extends string = ""> = R0 extends `${infer C1}${infer R1}`
// 	? C1 extends TokenChar
// 		? R1 extends `${infer C2}${infer R2}`
// 			? C2 extends TokenChar
// 				? ReadTokenChars<R2, `${Acc}${C1}${C2}`>
// 				: [`${Acc}${C1}`, R1]
// 			: [`${Acc}${C1}`, R1]
// 		: [Acc, R0]
// : [Acc, ""]

type ReadTokenChars<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends TokenChar
		? ReadTokenChars<Rest, `${Acc}${C}`>
		: { __token__: Acc; __rest__: S }
	: { __token__: Acc; __rest__: "" }

type Ws = " " | "\n" | "\t" | "\r"

type StartTokenChar = Letter | Digit | "$" | "_"

type TokenChar = Letter | Digit | "$" | "_"

type Letter = LowerCaseLetter | UpperCaseLetter

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

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
	as: true
	begin: true
	by: true
	character: true
	check: true
	column: true
	constraint: true
	create: true
	cross: true
	database: true
	declare: true
	default: true
	delete: true
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
	inet: true
	inner: true
	insert: true
	int: true
	int4range: true
	into: true
	join: true
	key: true
	language: true
	left: true
	limit: true
	natural: true
	not: true
	null: true
	offset: true
	on: true
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
	select: true
	table: true
	text: true
	timestamp: true
	timestampz: true
	timetz: true
	to: true
	true: true
	unique: true
	use: true
	using: true
	uuid: true
	values: true
	varying: true
	where: true
}
