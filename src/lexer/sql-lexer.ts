import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { DialectOnlyError, LexerFact } from "../core/dialect.ts"
import type { DialectConstruct } from "../core/dialect-constructs.ts"
import type {
	Return,
	TokenKey,
	TokenIdent,
	TokenString,
	TokenInteger,
	TokenParam,
	TokenIndexedParam,
	TokenEot,
} from "./sql-lexer-tokens.ts"
import type { ServiceWords } from "./sql-lexer-words.ts"
import type {
	OperatorChars,
	ReadOperator,
	SkipSpaces,
	StartTokenChar,
	TokenChar,
	Digit,
	NonZeroDigit,
	GetNumber,
	GetNumberFrac,
	SomeSymbols,
	Whitespace,
	IdentChar,
	AsciiChar,
	FoldAsciiCase,
	FoldAsciiChars,
} from "./sql-lexer-chars.ts"

export type {
	TokenKind,
	TokenType,
	TokenKey,
	TokenIdent,
	TokenString,
	TokenInteger,
	TokenFloat,
	TokenNumber,
	TokenParam,
	TokenIndexedParam,
	TokenEot,
	TokenStreamHead,
} from "./sql-lexer-tokens.ts"
export type { AsIdent } from "./sql-lexer-words.ts"

export type LexerNamedQueryParams = "named-params"
export type LexerIndexedQueryParams = "indexed-params" | "question-params"
type LexerQueryParams = LexerNamedQueryParams | LexerIndexedQueryParams

export type LexerFeatures = "" | LexerQueryParams

export type ApplyAllowedQueryParams<Syntax extends LexerFeatures, AllowedQueryParams extends LexerQueryParams> =
	Exclude<Syntax, LexerQueryParams> | Extract<Syntax, AllowedQueryParams>

/**
 * An operator token. Where `?` is a parameter (`question-params`, SQLite) it never belongs to an operator: `-?` and
 * `=?` are the operator, then the parameter (#180; PostgreSQL's operator lexing would read `-?` as one operator). The
 * text before the `?` is read again on its own, as an operator ending in `+` / `-` is then cut before them.
 */
type ReadOperatorIn<S extends string, Syntax extends string> = "question-params" extends Syntax
	? ReadOperator<S> extends [TokenKey<infer Word extends string>, infer Tail extends string]
		? Word extends `${infer Before}?${infer After}`
			? Before extends ""
				? Return<TokenKey<"?">, `${After}${Tail}`>
				: ReadOperator<Before> extends [infer Op, infer Left extends string] // `<>-?`: `<>`, then `-`
					? Return<Op, `${Left}?${After}${Tail}`>
					: never
			: ReadOperator<S>
		: ReadOperator<S>
	: ReadOperator<S>

/** Lex one token from a string (internal) */
export type ReadTokenFromString<S extends string, Syntax extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends StartTokenChar
		? ReadIdentWord<Head, Rest, Syntax>
		: Head extends "/"
			? Rest extends `*${string}`
				? SkipSpaces<S, LexerFact<Syntax, "nestedComments">> extends S
					? Return<FormatError<Errors["UNCLOSED_BLOCK_COMMENT"], []>, S>
					: ReadTokenFromString<SkipSpaces<S, LexerFact<Syntax, "nestedComments">>, Syntax>
				: ReadOperatorIn<S, Syntax>
			: Head extends "-"
				? Rest extends `-${string}`
					? ReadTokenFromString<SkipSpaces<S, LexerFact<Syntax, "nestedComments">>, Syntax>
					: ReadOperatorIn<S, Syntax>
				: Head extends "`"
					? Rest extends `${infer Name}\`${infer Rest2}`
						? Tagged<QuotedIdent<Name, Rest2, Syntax>, "sqlite-backtick-ident">
						: ReadOperatorIn<S, Syntax>
					: Head extends "["
						? LexerFact<Syntax, "bracketIdents"> extends true
							? Rest extends `${infer Name}]${infer Rest2}`
								? // `text[]`, `array[1, 2]`, `array['a']`, `a[1]` keep their brackets (SQLT-53)
									Name extends
										"" | `${string},${string}` | `${string}'${string}` | `${Digit}${string}`
									? Return<TokenKey<Head>, Rest>
									: QuotedIdent<Name, Rest2, Syntax>
								: Return<TokenKey<Head>, Rest>
							: Return<TokenKey<Head>, Rest>
						: Head extends "@" | "?"
							? ReadSqliteParamOrOperator<S, Head, Rest, Syntax>
							: Head extends OperatorChars
								? ReadOperatorIn<S, Syntax>
								: Head extends Digit
									? GetNumber<Rest, Head>
									: Head extends "."
										? Rest extends `${infer Second}${infer Rest2}`
											? Second extends Digit
												? GetNumberFrac<Rest2, `${Head}${Second}`>
												: Return<TokenKey<".">, Rest>
											: Return<TokenKey<".">, Rest>
										: Head extends '"'
											? Rest extends `${infer String}"${infer Rest}`
												? QuotedIdent<String, Rest, Syntax>
												: Return<FormatError<Errors["UNCLOSED_QUOTED_IDENTIFIER"], []>, S>
											: Head extends Whitespace
												? ReadTokenFromString<
														SkipSpaces<Rest, LexerFact<Syntax, "nestedComments">>,
														Syntax
													>
												: Head extends "'"
													? ReadSingleQuotedString<Rest, Syntax>
													: Head extends ":"
														? Rest extends `${infer Next}${infer Rest2}`
															? Next extends ":"
																? Return<TokenKey<"::">, Rest2>
																: Next extends TokenChar
																	? "named-params" extends Syntax
																		? ReadTokenChars<Rest2> extends {
																				token: infer Token extends string
																				rest: infer Rest3 extends string
																			}
																			? Return<
																					TokenParam<`${Next}${Token}`>,
																					Rest3
																				>
																			: never
																		: Return<TokenKey<":">, Rest>
																	: Return<TokenKey<":">, Rest>
															: Return<TokenKey<":">, Rest>
														: Head extends "$"
															? Rest extends `${infer Next}${infer Rest2}`
																? Next extends "$" | StartTokenChar
																	? IsSqliteNamedParam<Syntax, Next> extends true
																		? ReadTokenChars<Rest2> extends {
																				token: infer Token extends string
																				rest: infer Rest3 extends string
																			}
																			? Return<
																					TokenParam<`${Next}${Token}`>,
																					Rest3
																				>
																			: never
																		: LexerFact<
																					Syntax,
																					"dollarStrings"
																			  > extends true
																			? Tagged<
																					ReadDollarString<Rest>,
																					"pg-dollar-string"
																				>
																			: IsDialectForbidden<
																						Syntax,
																						"pg-dollar-string"
																				  > extends true
																				? ReadDollarString<Rest> extends Return<
																						infer Str extends
																							TokenString<string>,
																						infer Rest3 extends string
																					>
																					? Tagged<
																							Return<Str, Rest3>,
																							"pg-dollar-string"
																						>
																					: Return<
																							FormatError<
																								Errors["UNEXPECTED_TOKEN"],
																								[SomeSymbols<S>]
																							>,
																							S
																						>
																				: Return<
																						FormatError<
																							Errors["UNEXPECTED_TOKEN"],
																							[SomeSymbols<S>]
																						>,
																						S
																					>
																	: Next extends NonZeroDigit
																		? "indexed-params" extends Syntax
																			? Tagged<
																					ReadIndexedParam<Next, Rest2>,
																					"pg-positional-param"
																				>
																			: IsDialectForbidden<
																						Syntax,
																						"pg-positional-param"
																				  > extends true
																				? Tagged<
																						ReadIndexedParam<Next, Rest2>,
																						"pg-positional-param"
																					>
																				: Return<
																						FormatError<
																							Errors["UNEXPECTED_TOKEN"],
																							[SomeSymbols<S>]
																						>,
																						S
																					>
																		: Return<
																				FormatError<
																					Errors["UNEXPECTED_TOKEN"],
																					[SomeSymbols<S>]
																				>,
																				S
																			>
																: Return<
																		FormatError<
																			Errors["UNEXPECTED_TOKEN"],
																			[SomeSymbols<S>]
																		>,
																		S
																	>
															: Head extends AsciiChar
																? Return<TokenKey<Head>, Rest>
																: ReadIdentWord<Head, Rest, Syntax>
	: Return<TokenEot, "">

/** An unquoted identifier or keyword starting with `Head` (a letter, `_` or a non-ASCII character). */
type ReadIdentWord<Head extends string, Rest extends string, Syntax extends string> =
	ReadTokenChars<Rest, IdentChar, Head extends AsciiChar ? true : "seen"> extends {
		token: infer Word extends string
		rest: infer Tail extends string
		nonAscii: infer N
	}
		? ReadWord<
				Head,
				Word,
				Tail,
				Syntax,
				N extends "seen" ? FoldAsciiChars<`${Head}${Word}`> : Lowercase<`${Head}${Word}`>
			>
		: never

/**
 * A token that is a one-dialect construct (src/core/dialect.ts). The parser monad turns the tag into the
 * other-dialect error when the chain's dialect lacks the construct; the token itself is read normally.
 */
type Tagged<R, Construct extends DialectConstruct> = R extends [infer Token, infer Rest]
	? Token extends DbtyperErrorShape
		? R
		: [Token, Rest, Construct]
	: R

type IsDialectForbidden<Syntax extends string, Construct extends DialectConstruct> =
	DialectOnlyError<Syntax, Construct> extends null ? false : true

/**
 * SQLite parameter forms beyond `:name` and `?` (SQLT-30, #65): `@name` and `$name` are named like `:name`, `?NNN`
 * is the numbered form of `?`. They exist in a SQLite chain only; elsewhere `@`, `$name` and `?` are what they were.
 */
type IsSqliteNamedParam<Syntax extends string, Next extends string> =
	LexerFact<Syntax, "atParams"> extends true
		? "named-params" extends Syntax
			? Next extends "$"
				? false
				: true
			: false
		: false

type ReadSqliteParamOrOperator<S extends string, Head extends string, Rest extends string, Syntax extends string> =
	LexerFact<Syntax, "atParams"> extends true
		? Rest extends `${infer Next}${infer Rest2}`
			? Head extends "@"
				? Next extends StartTokenChar
					? "named-params" extends Syntax
						? ReadTokenChars<Rest2> extends {
								token: infer Token extends string
								rest: infer Rest3 extends string
							}
							? Return<TokenParam<`${Next}${Token}`>, Rest3>
							: never
						: ReadOperatorIn<S, Syntax>
					: ReadOperatorIn<S, Syntax>
				: Next extends NonZeroDigit
					? "question-params" extends Syntax
						? ReadIndexedParam<Next, Rest2>
						: ReadOperatorIn<S, Syntax>
					: ReadOperatorIn<S, Syntax>
			: ReadOperatorIn<S, Syntax>
		: ReadOperatorIn<S, Syntax>

type ReadIndexedParam<Head extends string, Rest extends string> =
	GetIndexingNumber<Head, Rest> extends Return<infer Index extends TokenInteger<string>, infer Rest2 extends string>
		? Return<TokenIndexedParam<Index["value"]>, Rest2>
		: Return<
				FormatError<
					Errors["INVALID_INDEXED_PARAM"],
					[`$${Head}${ReadTokenChars<Rest, TokenChar | "." | "+" | "-">["token"]}`]
				>,
				Rest
			>

type GetIndexingNumber<Head extends string, Rest extends string> =
	GetNumber<Rest, Head> extends Return<infer Number extends TokenInteger<string>, infer Rest2 extends string>
		? IsIndexingNumber<Number["value"]> extends true
			? Return<Number, Rest2>
			: Return<FormatError<Errors["UNEXPECTED_TOKEN"], [SomeSymbols<Rest>]>, Rest>
		: Return<FormatError<Errors["UNEXPECTED_TOKEN"], [SomeSymbols<Rest>]>, Rest>

type IsIndexingNumber<S extends string> = S extends `${string}_${string}`
	? false
	: S extends `0${string}`
		? false
		: true

type ReadDollarString<S extends string> = S extends `${infer Head}${infer Rest}`
	? Head extends "$"
		? Rest extends `${infer String}$$${infer Rest2}`
			? Return<TokenString<String>, Rest2>
			: Return<FormatError<Errors["UNCLOSED_TAGGED_STRING"], []>, S>
		: Head extends StartTokenChar
			? Rest extends `${infer Tag}$${infer Rest2}`
				? ReadTokenChars<Tag> extends { rest: "" }
					? Rest2 extends `${infer String}$${Head}${Tag}$${infer Rest3}`
						? Return<TokenString<String>, Rest3>
						: Return<FormatError<Errors["UNCLOSED_TAGGED_STRING"], []>, S>
					: Return<FormatError<Errors["WRONG_STRING_TAG"], []>, S>
				: Return<FormatError<Errors["WRONG_STRING_TAG"], []>, S>
			: Return<FormatError<Errors["WRONG_STRING_TAG"], []>, S>
	: Return<FormatError<Errors["WRONG_STRING_TAG"], []>, S>

/**
 * A word: identifier or keyword, lower-cased. In a SQLite chain (SQLT-27, SQLT-28) an identifier also remembers how it
 * was written (`written`), because a result key is named as written in the query; `X'…'` is a blob literal (SQLT-29).
 */
type ReadWord<
	Head extends string,
	Word extends string,
	Tail extends string,
	Syntax extends string,
	L extends string,
> = Word extends ""
	? Head extends "x" | "X"
		? LexerFact<Syntax, "blobLiterals"> extends true
			? Tail extends `'${infer Body}'${infer Rest2}`
				? Return<TokenString<Body> & { blob: true }, Rest2>
				: ReadPlainWord<Head, Word, Tail, Syntax, L>
			: ReadPlainWord<Head, Word, Tail, Syntax, L>
		: ReadPlainWord<Head, Word, Tail, Syntax, L>
	: ReadPlainWord<Head, Word, Tail, Syntax, L>

/** `L`: the word folded to lower case, ASCII letters only, as both engines fold unquoted names (STMT-25). */
type ReadPlainWord<
	Head extends string,
	Word extends string,
	Tail extends string,
	Syntax extends string,
	L extends string,
> =
	LexerFact<Syntax, "keepWritten"> extends true
		? ReadSqliteWord<Head, Word, Tail, L>
		: LexerFact<Syntax, "callableJoinWords"> extends true
			? L extends "left" | "right"
				? // `left(s, n)` and `right(s, n)` are functions (PGT-28); the join keywords are never followed by `(`
					Tail extends `(${string}`
					? Return<TokenIdent<L>, Tail>
					: Return<CheckIdentOrKey<L>, Tail>
				: Return<CheckIdentOrKey<L>, Tail>
			: Return<CheckIdentOrKey<L>, Tail>

type ReadSqliteWord<Head extends string, Word extends string, Tail extends string, L extends string> =
	CheckIdentOrKey<L> extends infer T
		? T extends TokenIdent<string>
			? WithWritten<T, L, `${Head}${Word}`, Tail>
			: Return<T, Tail>
		: never

/** A quoted identifier (`"x"`, and in SQLite `` `x` `` and `[x]`): its case is kept, except in SQLite, where names match case-insensitively (SQLT-27). */
type QuotedIdent<Name extends string, Rest extends string, Syntax extends string> =
	LexerFact<Syntax, "foldQuoted"> extends true
		? FoldAsciiCase<Name> extends infer L extends string
			? WithWritten<TokenIdent<L>, L, Name, Rest>
			: never
		: Return<TokenIdent<Name>, Rest>

/** The identifier token remembers how it was written, only when that differs from its folded value `L` (cheaper tokens). */
type WithWritten<
	T extends TokenIdent<string>,
	L extends string,
	Written extends string,
	Rest extends string,
> = L extends Written ? Return<T, Rest> : Return<T & { written: Written }, Rest>

type ReadSingleQuotedString<S extends string, Syntax extends string = ""> = S extends `${infer P1}'${infer R1}`
	? R1 extends `'${infer R2}`
		? ReadSingleQuotedString<R2, Syntax> extends Return<
				TokenString<infer P2 extends string>,
				infer R3 extends string
			>
			? Return<TokenString<`${P1}'${P2}`>, R3>
			: Return<FormatError<Errors["UNCLOSED_STRING_LITERAL"], []>, S>
		: SkipSpaces<R1, LexerFact<Syntax, "nestedComments">> extends infer R4 extends string
			? R4 extends `'${infer R5}`
				? LexerFact<Syntax, "joinStrings"> extends false
					? Return<TokenString<P1>, R4>
					: ReadSingleQuotedString<R5, Syntax> extends Return<
								TokenString<infer P6 extends string>,
								infer R6 extends string
						  >
						? Return<TokenString<`${P1}${P6}`>, R6>
						: Return<FormatError<Errors["UNCLOSED_STRING_LITERAL"], []>, S>
				: Return<TokenString<P1>, R4>
			: never
	: Return<FormatError<Errors["UNCLOSED_STRING_LITERAL"], []>, S>

type CheckIdentOrKey<S extends string> = S extends ServiceWords ? TokenKey<S> : TokenIdent<S>

/**
 * `NonAscii`: a character outside ASCII belongs to the word too (identifiers); once one is read it becomes `"seen"`,
 * and the result carries `nonAscii: "seen"` (the word is then folded ASCII-only, {@link FoldAsciiChars}).
 */
type ReadTokenChars<
	S extends string,
	Chars = TokenChar,
	NonAscii extends boolean | "seen" = false,
> = OptimizedBySpaceReadTokenChars<S, Chars, NonAscii>

type OptimizedBySpaceReadTokenChars<
	S extends string,
	Chars = TokenChar,
	NonAscii extends boolean | "seen" = false,
> = S extends `${infer SmallerBuffer}\x20${infer Rest extends string}`
	? ReadTokenCharsRaw<SmallerBuffer, Chars, "", NonAscii> extends {
			token: infer T extends string
			rest: infer SmallerRest extends string
			nonAscii: infer N
		}
		? SmallerRest extends ""
			? { token: T; rest: Rest; nonAscii: N }
			: S extends `${T}${infer Rest2}`
				? { token: T; rest: Rest2; nonAscii: N }
				: never
		: ReadTokenCharsRaw<S, Chars, "", NonAscii>
	: ReadTokenCharsRaw<S, Chars, "", NonAscii>

type ReadTokenCharsRaw<
	S extends string,
	Chars = TokenChar,
	Acc extends string = "",
	NonAscii extends boolean | "seen" = false,
> = S extends `${infer C}${infer Rest}`
	? C extends Chars
		? ReadTokenCharsRaw<Rest, Chars, `${Acc}${C}`, NonAscii>
		: NonAscii extends false
			? { token: Acc; rest: S; nonAscii: NonAscii }
			: C extends AsciiChar
				? { token: Acc; rest: S; nonAscii: NonAscii }
				: ReadTokenCharsRaw<Rest, Chars, `${Acc}${C}`, "seen">
	: { token: Acc; rest: ""; nonAscii: NonAscii }
