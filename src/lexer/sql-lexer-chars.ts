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
	: S extends `${infer C}${infer Rest}`
		? C extends Whitespace
			? SkipSomeSpaces<Rest, [...Acc, 1]>
			: S extends `--${infer Comment}`
				? Comment extends `${string}\n${infer Rest}`
					? SkipSomeSpaces<Rest, [...Acc, 1]>
					: ["", false]
				: S extends `/*${infer Comment}`
					? SkipMultiComment<Comment> extends infer Rest extends string
						? SkipSomeSpaces<Rest, [...Acc, 1]>
						: [S, false] // unclosed: the lexer reports UNCLOSED_BLOCK_COMMENT at the `/*`
					: [S, false]
		: [S, false]

/** The whitespace characters of both engines (form feed included); the one list the lexer and the parser monad read. */
export type Whitespace = "\x20" | "\n" | "\t" | "\r" | "\f"

export type StartTokenChar = Letter | "_"

export type TokenChar = Letter | Digit | "_"

/**
 * The characters of an unquoted identifier after its first one: also `$` (`col$1`; both engines). A character outside
 * ASCII is an identifier character too, first one included (`імя`): see {@link AsciiChar}.
 */
export type IdentChar = TokenChar | "$"

/** The 128 ASCII characters; any other character may be part of an unquoted identifier (PostgreSQL and SQLite). */
export type AsciiChar =
	| "\x00"
	| "\x01"
	| "\x02"
	| "\x03"
	| "\x04"
	| "\x05"
	| "\x06"
	| "\x07"
	| "\x08"
	| "\x09"
	| "\x0a"
	| "\x0b"
	| "\x0c"
	| "\x0d"
	| "\x0e"
	| "\x0f"
	| "\x10"
	| "\x11"
	| "\x12"
	| "\x13"
	| "\x14"
	| "\x15"
	| "\x16"
	| "\x17"
	| "\x18"
	| "\x19"
	| "\x1a"
	| "\x1b"
	| "\x1c"
	| "\x1d"
	| "\x1e"
	| "\x1f"
	| " "
	| "!"
	| '"'
	| "#"
	| "$"
	| "%"
	| "&"
	| "'"
	| "("
	| ")"
	| "*"
	| "+"
	| ","
	| "-"
	| "."
	| "/"
	| Digit
	| ":"
	| ";"
	| "<"
	| "="
	| ">"
	| "?"
	| "@"
	| Letter
	| "["
	| "\\"
	| "]"
	| "^"
	| "_"
	| "`"
	| "{"
	| "|"
	| "}"
	| "~"
	| "\x7f"

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

/** The text after the end of the comment (block comments nest), or `false` when it is not closed. */
type SkipMultiComment<S extends string> = S extends `${infer Comment}*/${infer Rest}`
	? Comment extends `${string}/*${string}`
		? Skip2Comments<S>
		: Comment extends `${string}/`
			? Skip2Comments<S>
			: Rest
	: false

type Skip2Comments<S extends string> = S extends `${string}/*${infer Rest}`
	? SkipMultiComment<Rest> extends infer Inner extends string
		? SkipMultiComment<Inner>
		: false
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

/** The first 15 characters of `Text`: the snippet an error message quotes (long enough to find the place, short enough to read). */
export type SomeSymbols<Text extends string> = Text extends `${infer Result}${SkipSymbols<Text, 15>}` ? Result : never

type SkipSymbols<Text extends string, Count extends number> = Count extends 0
	? Text
	: Text extends `${string}${infer Rest}`
		? SkipSymbols<Rest, Dec<Count>>
		: Text
