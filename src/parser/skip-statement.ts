import type { PeekToken, SkipToken, SqlParserError, TokensList, TokenKind, TokenType } from "../../core/sql-tokens.ts"

export type SkippedStatement<Token extends TokenType<TokenKind, string> = TokenType<TokenKind, string>> = {
	kind: "skipped-statement"
	token: Token
}

export type SkipStatement<
	Tokens extends TokensList,
	EndToken extends TokenType<TokenKind, string> = TokenType<"eot"> | TokenType<"key", ";">,
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends TokenType<"key", "(">
		? SkipStatement<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
		: PeekToken<Tokens> extends TokenType<"key", "[">
			? SkipStatement<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
			: ClosingBracketsStack extends [
						infer CurrentClosingBracket extends ClosingBrackets,
						...infer Tail extends ClosingBrackets[],
				  ]
				? PeekToken<Tokens> extends TokenType<"eot">
					? [Tokens, SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>]
					: PeekToken<Tokens> extends TokenType<"key", CurrentClosingBracket>
						? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenType<"key", ClosingBrackets>
							? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok
					? EndTok extends EndToken
						? [SkipToken<Tokens>, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends TokenType<"eot">
							? [Tokens, SqlParserError<"Token not found">]
							: PeekToken<Tokens> extends TokenType<"key", ClosingBrackets>
								? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
								: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
