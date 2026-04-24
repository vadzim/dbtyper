import type { PeekToken, SkipToken, SqlParserError, TokensList, TokenType } from "../../core/sql-tokens.ts"

export type SkippedStatement<Token extends TokenType<string> = TokenType<string>> = {
	kind: "skipped-statement"
	token: Token
}

export type SkipStatement<
	Tokens extends TokensList,
	EndToken = "" | ";",
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends TokenType<"(">
		? SkipStatement<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
		: PeekToken<Tokens> extends TokenType<"[">
			? SkipStatement<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
			: ClosingBracketsStack extends [
						infer CurrentClosingBracket extends ClosingBrackets,
						...infer Tail extends ClosingBrackets[],
				  ]
				? PeekToken<Tokens> extends TokenType<"">
					? [Tokens, SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>]
					: PeekToken<Tokens> extends TokenType<CurrentClosingBracket>
						? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenType<ClosingBrackets>
							? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends TokenType<infer EndTok extends string>
					? EndTok extends EndToken
						? [SkipToken<Tokens>, SkippedStatement<TokenType<EndTok>>]
						: PeekToken<Tokens> extends TokenType<"">
							? [Tokens, SqlParserError<"Token not found">]
							: PeekToken<Tokens> extends TokenType<ClosingBrackets>
								? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
								: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
