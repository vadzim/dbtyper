import type { PeekToken, SkipToken, SqlParserError, TokensList, TokenType } from "../../core/sql-tokens.ts"

export type SkippedStatement<Token extends TokenType = TokenType> = {
	kind: "skipped-statement"
	token: Token
}

export type SkipStatement<
	Tokens extends TokensList,
	EndToken = "" | ";",
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends "("
		? SkipStatement<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
		: PeekToken<Tokens> extends "["
			? SkipStatement<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
			: ClosingBracketsStack extends [
						infer CurrentClosingBracket extends ClosingBrackets,
						...infer Tail extends ClosingBrackets[],
				  ]
				? PeekToken<Tokens> extends ""
					? [Tokens, SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>]
					: PeekToken<Tokens> extends CurrentClosingBracket
						? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends ClosingBrackets
							? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>}`>]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok extends TokenType
					? EndTok extends EndToken
						? [SkipToken<Tokens>, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends ""
							? [Tokens, SqlParserError<"Token not found">]
							: PeekToken<Tokens> extends ClosingBrackets
								? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>}`>]
								: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
