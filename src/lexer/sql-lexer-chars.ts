import type { Dec } from "../core/type-utils.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { Return, TokenFloat, TokenInteger, TokenKey } from "./sql-lexer-tokens.ts"

export type OperatorChars = PlusMinus | NarrowOperatorChars | WideOperatorChars
type PlusMinus = "+" | "-"
type NarrowOperatorChars = "*" | "/" | "<" | ">" | "="
type WideOperatorChars = "~" | "!" | "@" | "#" | "%" | "^" | "&" | "|" | "`" | "?"

export type ReadOperator<S extends string> =
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

export type SkipSpaces<S> =
	SkipSomeSpaces<S> extends [infer R extends string, infer HasMoreSpace]
		? HasMoreSpace extends true
			? SkipSpaces<R>
			: R
		: never

/**
 * Skips up to 100 spaces per call; `SkipSpaces` calls it again while more are left. The bound keeps the recursion
 * depth of one call under TypeScript's instantiation depth limit (found by trial on long indented SQL, #48, #105);
 * it is a depth bound, not a limit on the number of spaces.
 * TLVL-4: the limit dodged is the instantiation depth limit (TS2589); tests: test/stress/sqlt-105-long-statement.
 */
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
export type StartTokenChar = Letter | "_"

export type TokenChar = Letter | Digit | "_"

export type NonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

export type Digit = "0" | NonZeroDigit

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

export type GetNumber<S extends string, Num extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumber<Rest, `${Num}${D1}`>
		: D1 extends "."
			? GetNumberFrac<Rest, `${Num}${D1}`>
			: D1 extends "e" | "E"
				? GetNumberExpStart<Rest, `${Num}${D1}`>
				: D1 extends Letter
					? Return<FormatError<Errors["INVALID_NUMBER"], []>, S>
					: Return<TokenInteger<Num>, S>
	: Return<TokenInteger<Num>, S>

export type GetNumberFrac<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberFrac<Rest, `${Buf}${D1}`>
		: D1 extends "e" | "E"
			? GetNumberExpStart<Rest, `${Buf}${D1}`>
			: D1 extends Letter
				? Return<FormatError<Errors["INVALID_NUMBER"], []>, S>
				: Return<TokenFloat<Buf>, S>
	: Return<TokenFloat<Buf>, S>

type GetNumberExpStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends "+" | "-"
		? GetNumberExpNumStart<Rest, `${Buf}${D1}`>
		: D1 extends Digit
			? GetNumberExpNum<Rest, `${Buf}${D1}`>
			: Return<FormatError<Errors["INVALID_NUMBER"], []>, S>
	: Return<FormatError<Errors["INVALID_NUMBER"], []>, S>

type GetNumberExpNumStart<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: Return<FormatError<Errors["INVALID_NUMBER"], []>, S>
	: Return<FormatError<Errors["INVALID_NUMBER"], []>, S>

type GetNumberExpNum<S extends string, Buf extends string> = S extends `${infer D1}${infer Rest}`
	? D1 extends Digit
		? GetNumberExpNum<Rest, `${Buf}${D1}`>
		: D1 extends Letter
			? Return<FormatError<Errors["INVALID_NUMBER"], []>, S>
			: Return<TokenFloat<Buf>, S>
	: Return<TokenFloat<Buf>, S>

export type SomeSymbols<Text extends string> = Text extends `${infer Result}${SkipSymbols<Text, 15>}` ? Result : never

type SkipSymbols<Text extends string, Count extends number> = Count extends 0
	? Text
	: Text extends `${string}${infer Rest}`
		? SkipSymbols<Rest, Dec<Count>>
		: Text
