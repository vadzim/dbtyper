import type { ReplaceProp } from "../core/type-utils.ts"
import type { LexerFeatures, ReadTokenFromString, TokenStreamHead } from "./sql-lexer.ts"

export type CreateParserMonad<Query extends string, Syntax extends string = LexerFeatures> =
	ReadTokenFromString<Query, Syntax> extends [infer Token extends TokenStreamHead, infer Rest extends string]
		? [Buffer<Token, Rest, Syntax, 0>] extends [infer B extends ParserMonad]
			? B
			: never
		: never

export type ParserMonad = Buffer<TokenStreamHead, string, string, number>

export type EmptyTokenList = CreateParserMonad<"", string>

export type PeekToken<M extends ParserMonad> = M[typeof tokenKey]

export type SkipToken<M extends ParserMonad> =
	ReadTokenFromString<M[typeof restKey], M["syntax"]> extends [
		infer Token extends TokenStreamHead,
		infer Rest extends string,
	]
		? {
				[tokenKey]: Token
				[restKey]: Rest
				syntax: M["syntax"]
				positionalIndex: M["positionalIndex"]
			}
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
