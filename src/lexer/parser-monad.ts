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

export type SkipToken<M extends ParserMonad> = ReadToken<M[typeof restKey], M["syntax"], M["positionalIndex"]>

type ReadToken<Rest extends string, Syntax extends string, PositionalIndex extends number> =
	ReadTokenFromString<Rest, Syntax> extends [infer Token extends TokenStreamHead, infer Rest extends string]
		? [Token, "question-params"] extends [TokenKey<"?">, Syntax]
			? Buffer<TokenIndexedParam<`${Inc[PositionalIndex]}`>, Rest, Syntax, Inc[PositionalIndex]>
			: Buffer<Token, Rest, Syntax, PositionalIndex>
		: never

const tokenKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

const restKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

type Buffer<
	Token extends TokenStreamHead,
	Rest extends string,
	Syntax extends string,
	PositionalIndex extends number,
> = {
	[tokenKey]: Token
	[restKey]: Rest
	syntax: Syntax
	positionalIndex: PositionalIndex
}
