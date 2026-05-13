import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ReplaceProp } from "../core/type-utils.ts"
import type { LexerFeatures, ReadTokenFromString, TokenStreamHead } from "./sql-lexer.ts"

export type CreateParserMonad<Query extends string, Syntax extends string = LexerFeatures> =
	ReadTokenFromString<Query, Syntax> extends [infer Token extends TokenStreamHead, infer Rest extends string]
		? [Buffer<Token, Rest, Syntax, null, 0>] extends [infer B extends ParserMonad]
			? B
			: never
		: never

export type ParserMonad = Buffer<TokenStreamHead, string, string, unknown, number>

export type EmptyTokenList = CreateParserMonad<"", string>

export type PeekToken<M extends ParserMonad> = M[typeof tokenKey]

export type SkipToken<M extends ParserMonad> =
	ReadTokenFromString<M[typeof restKey], M["syntax"]> extends [
		infer Token extends TokenStreamHead,
		infer Rest extends string,
	]
		? ReplaceProp<ReplaceProp<M, typeof restKey, Rest>, typeof tokenKey, Token> extends infer Ret extends
				ParserMonad
			? Ret
			: never
		: never

export type GetDB<M extends ParserMonad> = M["db"] extends infer Db extends JsqlDatabaseShape ? Db : never

export type SetDB<M extends ParserMonad, Db extends JsqlDatabaseShape> =
	ReplaceProp<M, "db", Db> extends infer Ret extends ParserMonad ? Ret : never

export type GetPositionalParamIndex<M extends ParserMonad> =
	M["positionalParamIndex"] extends infer PositionalParamIndex extends number ? PositionalParamIndex : never

export type SetPositionalParamIndex<M extends ParserMonad, PositionalParamIndex extends number> =
	ReplaceProp<M, "positionalParamIndex", PositionalParamIndex> extends infer Ret extends ParserMonad ? Ret : never

const tokenKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

const restKey = Symbol() // it's denied to export this symbol and use it outside this module in any directional or indirectional way

type Buffer<
	Token extends TokenStreamHead,
	Rest extends string,
	Syntax extends string,
	Db extends unknown,
	PositionalParamIndex extends number,
> = {
	[tokenKey]: Token
	[restKey]: Rest
	syntax: Syntax
	db: Db
	positionalParamIndex: PositionalParamIndex
}
