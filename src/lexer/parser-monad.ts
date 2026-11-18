import type { Inc } from "../core/type-utils.ts"
import type {
	LexerFeatures,
	ReadTokenFromString,
	TokenEot,
	TokenIndexedParam,
	TokenKey,
	TokenStreamHead,
} from "./sql-lexer.ts"

export type CreateParserMonad<Query extends string, Syntax extends string = LexerFeatures> = ReadToken<Query, Syntax, 0>

export type ParserMonad = Buffer<TokenStreamHead, string, string, number>

export type EmptyTokenList = Buffer<TokenEot, "", string, number>

export type PeekToken<M extends ParserMonad> = M[typeof tokenKey]

export type SkipToken<M extends ParserMonad> = ReadToken<
	M[typeof restKey],
	M[typeof syntaxKey],
	M[typeof positionalIndexKey]
>

type QuestionKey = TokenKey<"?">

/** SQLite `?NNN` (DSEL-4): the digits right after the `?`, or null when there are none. */
type ReadNumberedParam<S extends string, Acc extends string = ""> = S extends `${infer D}${infer Tail}`
	? D extends "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
		? ReadNumberedParam<Tail, `${Acc}${D}`>
		: Acc extends ""
			? null
			: [Acc, S]
	: Acc extends ""
		? null
		: [Acc, ""]

type ReadToken<_Rest extends string, Syntax extends string, PositionalIndex extends number> =
	ReadTokenFromString<_Rest, Syntax> extends [infer Token extends TokenStreamHead, infer Rest extends string]
		? "question-params" extends Syntax
			? Token extends QuestionKey
				? "dialect-sqlite" extends Syntax
					? ReadNumberedParam<Rest> extends [infer Digits extends string, infer After extends string]
						? Digits extends `${infer Index extends number}`
							? Buffer<TokenIndexedParam<Digits>, After, Syntax, Index>
							: never
						: Buffer<TokenIndexedParam<`${Inc<PositionalIndex>}`>, Rest, Syntax, Inc<PositionalIndex>>
					: Buffer<TokenIndexedParam<`${Inc<PositionalIndex>}`>, Rest, Syntax, Inc<PositionalIndex>>
				: Buffer<Token, Rest, Syntax, PositionalIndex>
			: Buffer<Token, Rest, Syntax, PositionalIndex>
		: never

type Buffer<
	Token extends TokenStreamHead,
	Rest extends string,
	Syntax extends string,
	PositionalIndex extends number,
> = {
	[tokenKey]: Token
	[restKey]: Rest
	[syntaxKey]: Syntax
	[positionalIndexKey]: PositionalIndex
}

// it's denied to export one of these symbols and use them outside of this module in any directional or indirectional way:
declare const tokenKey: unique symbol
declare const restKey: unique symbol
declare const syntaxKey: unique symbol
declare const positionalIndexKey: unique symbol
