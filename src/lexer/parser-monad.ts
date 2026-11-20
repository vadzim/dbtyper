import type { Inc } from "../core/type-utils.ts"
import type { DialectOnlyError, LexerFact, SyntaxWithoutLexerFact } from "../core/dialect.ts"
import type { DialectConstruct, DialectPhraseHeads, MatchDialectPhrase } from "../core/dialect-constructs.ts"
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

/** True when the lexer `Syntax` of the monad names `Flag` (a feature flag such as `single-statement`). */
export type HasSyntaxFlag<M extends ParserMonad, Flag extends string> = [Extract<M[typeof syntaxKey], Flag>] extends [
	never,
]
	? false
	: true

/**
 * Source spans (SQLT-28: a result key is the expression text as written). In a SQLite chain every token read carries
 * `from`, the text it was read from (the whitespace before it included), so the monad itself stays single-pass:
 * a parser reads the tokens with {@link PeekToken} at both ends of a span and {@link SourceSpan} subtracts them.
 * Other dialects pay nothing (no `from`, the span is empty).
 */
export type SourceSpan<Start, End> = Start extends { from: infer From extends string }
	? End extends { from: infer To extends string }
		? From extends `${infer Text}${To}`
			? TrimSpaces<Text>
			: ""
		: ""
	: ""

type Space = " " | "\n" | "\t" | "\r"

type TrimSpaces<S extends string> = S extends `${Space}${infer Tail}`
	? TrimSpaces<Tail>
	: S extends `${infer Head}${Space}`
		? TrimSpaces<Head>
		: S

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
		infer Token0 extends TokenStreamHead,
		infer Rest0 extends string,
		...infer Tag extends DialectConstruct[],
	]
		? // #117: this is the one place every parser's token read goes through, so a lexer error (1001-1004, 1008, 1009)
			// reaches ApplyStatements from any position (WHERE, DDL, INSERT, ...) without per-parser handling; parsers that
			// hit the truncated end-of-text give their own error, which ApplyStatements drops in favour of the lexer error.
			// After a lexer error the rest of the text is dropped and the token is end-of-text, which carries the error
			// (parsers see a truncated text; ApplyStatements reports the lexer error as the root cause)
			(Token0 extends DbtyperErrorShape ? [TokenEot, ""] : [Token0, Rest0]) extends [
				infer Token extends TokenStreamHead,
				infer Rest extends string,
			]
			? (
					Recorded extends DbtyperErrorShape
						? Recorded
						: Token0 extends DbtyperErrorShape
							? Token0 // a lexer error (1001-1004, 1008, 1009) is recorded like a dialect error: the root cause
							: TokenDialectError<Token, Tag, Rest, Syntax>
				) extends infer Rec extends DbtyperErrorShape | null
				? "question-params" extends Syntax
					? Token extends QuestionKey
						? Buffer<
								WithSource<TokenIndexedParam<`${Inc<PositionalIndex>}`>, _Rest, Syntax>,
								Rest,
								Syntax,
								Inc<PositionalIndex>,
								Rec
							>
						: Buffer<
								WithSource<WithDialectError<Token, Rec>, _Rest, Syntax>,
								Rest,
								Syntax,
								PositionalIndex,
								Rec
							>
					: Buffer<
							WithSource<WithDialectError<Token, Rec>, _Rest, Syntax>,
							Rest,
							Syntax,
							PositionalIndex,
							Rec
						>
				: never
			: never
		: never

/** SQLite chains only: the token remembers the text it was read from (see {@link SourceSpan}). */
type WithSource<Token, From extends string, Syntax extends string> =
	LexerFact<Syntax, "keepWritten"> extends true ? Token & { from: From } : Token

/**
 * The end-of-text token carries the first other-dialect error met in the text (DSEL-5, DSEL-6), so that
 * `ApplyStatements` can report it (lexer errors travel the same way, #116 item 25) (`TokenEotWithDialectError`) through the one reader, {@link PeekToken}.
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
				? [MatchDialectPhrase<K, W2, W3>] extends [never]
					? null
					: MatchDialectPhrase<K, W2, W3> extends [
								infer C extends DialectConstruct,
								infer Length extends number,
						  ]
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
	// the phrase check reads plain tokens: `array[1, 2]` is not a `[quoted name]`
	ReadTokenFromString<Rest, SyntaxWithoutLexerFact<Syntax, "bracketIdents">> extends [
		infer Token,
		infer Rest2 extends string,
		...unknown[],
	]
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
