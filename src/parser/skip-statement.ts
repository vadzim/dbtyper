import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { TokenType } from "../lexer/sql-lexer.ts"
import type { TokenKind } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError } from "../dbtyper-error.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"

export type SkippedStatement<Token extends TokenType<TokenKind, string> = TokenType<TokenKind, string>> = {
	kind: "skipped-statement"
	token: Token
}

export type ParseSkipStatement<Tokens extends ParserMonad, DB extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens> extends [infer Rest extends ParserMonad, infer Result]
		? [SkipToken<Rest>, DB, Result]
		: never

export type SkipFailedExpression<
	Tokens extends ParserMonad,
	Error extends DbtyperErrorShape,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
> =
	SkipBracketedUntil<Tokens, EndToken> extends [infer Rest extends ParserMonad, unknown]
		? [SkipToken<Rest>, Error]
		: never

export type SkipFailedExpressionWithEnv<
	Tokens extends ParserMonad,
	Error extends DbtyperErrorShape,
	Env,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
> =
	SkipBracketedUntil<Tokens, EndToken> extends [infer Rest extends ParserMonad, unknown]
		? [SkipToken<Rest>, Error, Env]
		: never

export type SkipFailedStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Error extends DbtyperErrorShape,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
> =
	SkipBracketedUntil<Tokens, EndToken> extends [infer Rest extends ParserMonad, unknown]
		? [SkipToken<Rest>, Db, Error]
		: never

export type SkipFailedQualifiedName<
	Tokens extends ParserMonad,
	Error extends DbtyperErrorShape,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
> =
	SkipBracketedUntil<Tokens, EndToken> extends [infer Rest extends ParserMonad, unknown]
		? [SkipToken<Rest>, Error, never, never]
		: never

export type SkipBracketedUntil<
	Tokens extends ParserMonad,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
		: PeekToken<Tokens> extends TokenKey<"[">
			? SkipBracketedUntil<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
			: ClosingBracketsStack extends [
						infer CurrentClosingBracket extends ClosingBrackets,
						...infer Tail extends ClosingBrackets[],
				  ]
				? PeekToken<Tokens> extends TokenEot
					? [Tokens, FormatError<"CLOSING_BRACKET_NOT_FOUND", [CurrentClosingBracket]>]
					: PeekToken<Tokens> extends TokenKey<CurrentClosingBracket>
						? SkipBracketedUntil<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
							? [Tokens, FormatError<"UNMATCHED_CLOSING_BRACKET", [PeekToken<Tokens>["value"]]>]
							: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok
					? EndTok extends EndToken
						? [Tokens, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends TokenEot
							? [Tokens, FormatError<"TOKEN_NOT_FOUND", []>]
							: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
								? [Tokens, FormatError<"UNMATCHED_CLOSING_BRACKET", [PeekToken<Tokens>["value"]]>]
								: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
