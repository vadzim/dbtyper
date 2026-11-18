import type { Inc } from "../core/type-utils.ts"
import type { DialectConstruct, DialectOnlyError, DialectPhraseHeads, MatchDialectPhrase } from "../core/dialect.ts"
import type { DbtyperErrorShape } from "../dbtyper-error.ts"
import type {
	LexerFeatures,
	ReadTokenFromString,
	TokenEot,
	TokenIndexedParam,
	TokenKey,
	TokenStreamHead,
} from "./sql-lexer.ts"

export type CreateParserMonad<Query extends string, Syntax extends string = LexerFeatures> = ReadToken<Query, Syntax, 0>

export type ParserMonad = Buffer<TokenStreamHead, string, string, number, DbtyperErrorShape | null>

export type EmptyTokenList = Buffer<TokenEot, "", string, number, DbtyperErrorShape | null>

export type PeekToken<M extends ParserMonad> = M[typeof tokenKey]

export type SkipToken<M extends ParserMonad> = ReadToken<
	M[typeof restKey],
	M[typeof syntaxKey],
	M[typeof positionalIndexKey],
	M[typeof dialectErrorKey]
>

type QuestionKey = TokenKey<"?">

type ReadToken<
	_Rest extends string,
	Syntax extends string,
	PositionalIndex extends number,
	Recorded extends DbtyperErrorShape | null = null,
> =
	ReadTokenFromString<_Rest, Syntax> extends [
		infer Token extends TokenStreamHead,
		infer Rest extends string,
		...infer Tag extends DialectConstruct[],
	]
		? (
				Recorded extends DbtyperErrorShape ? Recorded : TokenDialectError<Token, Tag, Rest, Syntax>
			) extends infer Rec extends DbtyperErrorShape | null
			? "question-params" extends Syntax
				? Token extends QuestionKey
					? Buffer<TokenIndexedParam<`${Inc<PositionalIndex>}`>, Rest, Syntax, Inc<PositionalIndex>, Rec>
					: Buffer<WithDialectError<Token, Rec>, Rest, Syntax, PositionalIndex, Rec>
				: Buffer<WithDialectError<Token, Rec>, Rest, Syntax, PositionalIndex, Rec>
			: never
		: never

/**
 * The end-of-text token carries the first other-dialect error met in the text (DSEL-5, DSEL-6), so that
 * `ApplyStatements` can report it (`TokenEotWithDialectError`) through the one reader, {@link PeekToken}.
 */
type WithDialectError<Token, Rec> = Rec extends DbtyperErrorShape
	? Token extends TokenEot
		? TokenEotWithDialectError<Rec>
		: Token
	: Token

export type TokenEotWithDialectError<E extends DbtyperErrorShape = DbtyperErrorShape> = TokenEot & { dialectError: E }

/**
 * Other-dialect error of one token: a construct the lexer tagged, or a keyword phrase of `DialectPhrases`
 * starting at this token (src/core/dialect.ts). Lookahead runs only for phrase heads.
 */
type TokenDialectError<
	Token,
	Tag extends DialectConstruct[],
	Rest extends string,
	Syntax extends string,
> = Tag extends [infer C extends DialectConstruct]
	? DialectOnlyError<Syntax, C>
	: Token extends TokenKey<infer K extends DialectPhraseHeads>
		? NextWord<Rest, Syntax> extends [infer W2 extends string, infer Rest2 extends string]
			? NextWord<Rest2, Syntax> extends [infer W3 extends string, infer Rest3 extends string]
				? MatchDialectPhrase<K, W2, W3> extends [infer C extends DialectConstruct, infer Length extends number]
					? DialectOnlyError<Syntax, C> extends null
						? null
						: DialectOnlyError<
								Syntax,
								C,
								Length extends 1 ? W2 : Length extends 2 ? W3 : NextWord<Rest3, Syntax>[0]
							>
					: null
				: null
			: null
		: null

/** The next word (keyword or identifier value, "" for anything else) and the text after it. */
type NextWord<Rest extends string, Syntax extends string> =
	ReadTokenFromString<Rest, Syntax> extends [infer Token, infer Rest2 extends string, ...unknown[]]
		? [Token extends { kind: "ident" | "key"; value: infer W extends string } ? W : "", Rest2]
		: ["", ""]

type Buffer<
	Token extends TokenStreamHead,
	Rest extends string,
	Syntax extends string,
	PositionalIndex extends number,
	DialectError extends DbtyperErrorShape | null,
> = {
	[tokenKey]: Token
	[restKey]: Rest
	[syntaxKey]: Syntax
	[positionalIndexKey]: PositionalIndex
	[dialectErrorKey]: DialectError
}

// it's denied to export one of these symbols and use them outside of this module in any directional or indirectional way:
declare const tokenKey: unique symbol
declare const restKey: unique symbol
declare const syntaxKey: unique symbol
declare const positionalIndexKey: unique symbol
declare const dialectErrorKey: unique symbol
