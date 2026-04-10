export type Buffer = { readonly __buffer__: string }
export type EmptyBuffer = { readonly __buffer__: "" }
export type InitBuffer<S extends string = string> = { readonly __buffer__: S }
export type BufferPayload<B extends Buffer> = B["__buffer__"]

export type ReadToken<B extends Buffer> =
	ReadTokenFromString<B["__buffer__"]> extends [infer Token extends string, infer Rest extends string]
		? [Token, InitBuffer<Rest>]
		: never

type ReadTokenFromString<S extends string> = S extends `${Ws}${infer Rest}`
	? ReadTokenFromString<Rest>
	: S extends `"${infer String}"${infer Rest}`
		? [`"${String}"`, Rest]
		: S extends `'${infer String}'${infer Rest}`
			? [`'${String}'`, Rest]
			: S extends `\`${infer String}\`${infer Rest}`
				? [`\`${String}\``, Rest]
				: S extends `[${infer String}]${infer Rest}`
					? [String, Rest]
					: S extends `--${infer Comment}`
						? Comment extends `${string}\n${infer Rest}`
							? ReadTokenFromString<Rest>
							: ["", ""]
						: S extends `/*${infer Comment}`
							? Comment extends `${string}*/${infer Rest}`
								? ReadTokenFromString<Rest>
								: ["", ""]
							: S extends `${infer Head}${infer Rest}`
								? Head extends StartTokenChar
									? OptimizedBySpaceReadTokenChars<Rest> extends [
											infer Word extends string,
											infer Rest extends string,
										]
										? [CheckDoubleQuotes<Lowercase<`${Head}${Word}`>>, Rest]
										: never
									: [Head, Rest]
								: [S, ""]

type CheckDoubleQuotes<S extends string> = S extends ServiceWords ? S : `"${S}"`

type OptimizedBySpaceReadTokenChars2<S extends string> = S extends `${infer SmallerBuffer} ${string}`
	? ReadTokenChars<SmallerBuffer> extends [infer T extends string, string]
		? S extends `${T}${infer Rest}`
			? [T, Rest]
			: never
		: never
	: ReadTokenChars<S>

type OptimizedBySpaceReadTokenChars<S extends string> = S extends `${infer SmallerBuffer} ${infer Rest extends string}`
	? ReadTokenChars<SmallerBuffer> extends [infer T extends string, infer SmallerRest extends string]
		? SmallerRest extends ""
			? [T, Rest]
			: [T, `${SmallerRest} ${Rest}`]
		: never
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
		: [Acc, S]
	: [Acc, ""]

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

type ServiceWords =
	| "add"
	| "alter"
	| "as"
	| "by"
	| "check"
	| "create"
	| "cross"
	| "database"
	| "default"
	| "delete"
	| "drop"
	| "exists"
	| "false"
	| "foreign"
	| "from"
	| "full"
	| "group"
	| "having"
	| "if"
	| "in"
	| "index"
	| "inner"
	| "insert"
	| "join"
	| "key"
	| "left"
	| "limit"
	| "natural"
	| "not"
	| "null"
	| "offset"
	| "on"
	| "order"
	| "outer"
	| "primary"
	| "rename"
	| "references"
	| "right"
	| "schema"
	| "select"
	| "table"
	| "true"
	| "unique"
	| "use"
	| "using"
	| "where"
	| "column"
	| "to"
