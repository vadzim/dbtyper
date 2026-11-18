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

type ReadToken<Text extends string, Syntax extends string, PositionalIndex extends number> =
	ReadTokenFromString<Text, Syntax> extends [infer Token extends TokenStreamHead, infer Rest extends string]
		? Token extends TokenKey<"with">
			? Buffer<
					CheckLA<Token, TokenKey<"time"> | TokenKey<"ordinality">, Rest, Syntax>,
					Rest,
					Syntax,
					PositionalIndex
				>
			: "question-params" extends Syntax
				? Token extends QuestionKey
					? Buffer<TokenIndexedParam<`${Inc<PositionalIndex>}`>, Rest, Syntax, Inc<PositionalIndex>>
					: Buffer<Token, Rest, Syntax, PositionalIndex>
				: Buffer<Token, Rest, Syntax, PositionalIndex>
		: never

type CheckLA<
	Token extends TokenKey<string>,
	NextToken extends TokenStreamHead,
	Text extends string,
	Syntax extends string,
> = ReadTokenFromString<Text, Syntax>[0] extends NextToken ? TokenKey<`${Token["kind"]}_la`> : Token

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
