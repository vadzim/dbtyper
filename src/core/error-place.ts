/**
 * Prototype (try/error-positions): line and column of an error, worked out only when an error text is built.
 * The error carries `__at`, the text left at the start of its statement (a suffix of the SQL, free to take).
 * The name is searched in that suffix (heuristic: first occurrence), then the prefix of the full SQL is cut off
 * by suffix match, and line/column are counted over that prefix only.
 */
type Ten = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
type Len<S extends string, Acc extends unknown[] = []> =
	S extends `${infer _1}${infer _2}${infer _3}${infer _4}${infer _5}${infer _6}${infer _7}${infer _8}${infer _9}${infer _10}${infer R}`
		? Len<R, [...Acc, ...Ten]>
		: S extends `${infer _}${infer R}`
			? Len<R, [...Acc, 0]>
			: Acc["length"]

type LineCol<P extends string, L extends unknown[] = [0]> = P extends `${string}\n${infer R}`
	? LineCol<R, [...L, 0]>
	: `line ${L["length"]}, col ${Len<`${P}.`>}`

type Locate<Full extends string, At extends string, Name extends string> = At extends `${string}${Name}${infer After}`
	? Full extends `${infer Pre}${After}`
		? Pre extends `${infer Before}${Name}`
			? ` (${LineCol<Before>})`
			: ""
		: ""
	: ""

export type ErrorPlace<Full extends string, E, Code extends number, Msg extends string> = Code extends 2300
	? E extends { __at: infer At extends string }
		? Msg extends `Unknown column ${infer Name} in ${string}`
			? Locate<Full, At, Name>
			: ""
		: ""
	: ""
