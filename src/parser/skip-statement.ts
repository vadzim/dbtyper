import type { PeekToken, SkipToken, TokensList, TokenEot, TokenKey, TokenKind, TokenType } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"

export type SkippedStatement<Token extends TokenType<TokenKind, string> = TokenType<TokenKind, string>> = {
	kind: "skipped-statement"
	token: Token
}

export type ParseSkipStatement<Tokens extends TokensList, DB extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens> extends [infer Rest extends TokensList, infer Result] ? [Rest, DB, Result] : never

export type SkipBracketedUntil<
	Tokens extends TokensList,
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
					? [Tokens, SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>]
					: PeekToken<Tokens> extends TokenKey<CurrentClosingBracket>
						? SkipBracketedUntil<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
							? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
							: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok
					? EndTok extends EndToken
						? [SkipToken<Tokens>, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends TokenEot
							? [Tokens, SqlParserError<"Token not found">]
							: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
								? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
								: SkipBracketedUntil<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
