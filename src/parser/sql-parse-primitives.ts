/** Low-level string / identifier parsing for SQL template literals. */

export type Ws = " " | "\n" | "\t" | "\r";
export type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S;
export type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S;
export type Trim<S extends string> = TrimLeft<TrimRight<S>>;
export type RemoveTrailingSemicolon<S extends string> = Trim<S> extends `${infer X};` ? Trim<X> : Trim<S>;
export type ToLower<S extends string> = Lowercase<S>;

type StripLineComment<S extends string> = S extends `${infer _Comment}\n${infer Rest}`
	? `\n${Rest}`
	: S extends `${infer _Comment}\r${infer Rest}`
		? `\r${Rest}`
		: "";
type StripBlockComment<S extends string> = S extends `${infer _Comment}*/${infer Rest}` ? Rest : "";
export type StripSqlComments<S extends string> = S extends `${infer Head}--${infer Tail}`
	? StripSqlComments<`${Head}${StripLineComment<Tail>}`>
	: S extends `${infer Head}/*${infer Tail}`
		? StripSqlComments<`${Head}${StripBlockComment<Tail>}`>
		: S;

type ReadDoubleQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends `"`
		? [`"${Acc}"`, Rest]
		: ReadDoubleQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`"${Acc}"`, ""];
type ReadBacktickQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "`"
		? [`\`${Acc}\``, Rest]
		: ReadBacktickQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`\`${Acc}\``, ""];
type ReadBracketQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "]"
		? [`[${Acc}]`, Rest]
		: ReadBracketQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`[${Acc}]`, ""];
export type ReadIdentifier<S extends string> = Trim<S> extends `"${infer Rest}`
	? ReadDoubleQuotedIdentifier<Rest>
	: Trim<S> extends `\`${infer Rest}`
		? ReadBacktickQuotedIdentifier<Rest>
		: Trim<S> extends `[${infer Rest}`
			? ReadBracketQuotedIdentifier<Rest>
			: ReadWord<Trim<S>>;
export type ReadWord<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends Ws | "," | "(" | ")"
		? [Acc, `${C}${Rest}`]
		: ReadWord<Rest, `${Acc}${C}`>
	: [Acc, ""];
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
	: [Acc, ""];
export type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"`
	? X
	: S extends `\`${infer X}\``
		? X
		: S extends `[${infer X}]`
			? X
			: S;

type FindFirstOpenParen<S extends string> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? Rest
		: FindFirstOpenParen<Rest>
	: never;
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
	: never;
export type FirstParenGroup<S extends string> = FindFirstOpenParen<S> extends infer Rest extends string
	? ReadParenContent<Rest> extends [infer Group extends string, string]
		? Group
		: never
	: never;
