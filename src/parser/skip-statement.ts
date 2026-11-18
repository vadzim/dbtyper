import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { TokenType } from "../lexer/sql-lexer.ts"
import type { TokenKind } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"

export type SkippedStatement<Token extends TokenType<TokenKind, string> = TokenType<TokenKind, string>> = {
	kind: "skipped-statement"
	token: Token
}

export type ParseSkipStatement<Tokens extends ParserMonad, DB extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens> extends [infer Rest extends ParserMonad, infer Result]
		? [SkipToken<Rest>, DB, Result]
		: never

/**
 * `CREATE TRIGGER …` (SQLite, SQLT-23), at the token after `TRIGGER`: skipped as ONE statement although its body
 * `BEGIN stmt; stmt; END` holds `;`. The body ends at the first `END` that is not the end of a `CASE`.
 */
export type ParseSkipTrigger<Tokens extends ParserMonad, DB extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens, TokenKey<"begin" | ";"> | TokenEot> extends [
		infer Rest extends ParserMonad,
		infer Result,
	]
		? Result extends DbtyperErrorShape
			? [SkipToken<Rest>, DB, Result]
			: PeekToken<Rest> extends TokenKey<"begin">
				? SkipTriggerBody<SkipToken<Rest>, DB, []>
				: [SkipToken<Rest>, DB, Result]
		: never

type SkipTriggerBody<Tokens extends ParserMonad, DB extends JsqlDatabaseShape, CaseDepth extends unknown[]> =
	PeekToken<Tokens> extends TokenEot
		? [Tokens, DB, FormatError<Errors["TOKEN_NOT_FOUND"], []>]
		: PeekToken<Tokens> extends TokenKey<"case">
			? SkipTriggerBody<SkipToken<Tokens>, DB, [...CaseDepth, 0]>
			: PeekToken<Tokens> extends TokenKey<"end">
				? CaseDepth extends [unknown, ...infer Tail]
					? SkipTriggerBody<SkipToken<Tokens>, DB, Tail>
					: ParseSkipStatement<SkipToken<Tokens>, DB>
				: SkipTriggerBody<SkipToken<Tokens>, DB, CaseDepth>

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
					? [Tokens, FormatError<Errors["CLOSING_BRACKET_NOT_FOUND"], [CurrentClosingBracket]>]
					: PeekToken<Tokens> extends TokenKey<CurrentClosingBracket>
						? SkipBracketedUntil<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
							? [Tokens, FormatError<Errors["UNMATCHED_CLOSING_BRACKET"], [PeekToken<Tokens>["value"]]>]
							: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok
					? EndTok extends EndToken
						? [Tokens, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends TokenEot
							? [Tokens, FormatError<Errors["TOKEN_NOT_FOUND"], []>]
							: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
								? [
										Tokens,
										FormatError<Errors["UNMATCHED_CLOSING_BRACKET"], [PeekToken<Tokens>["value"]]>,
									]
								: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
