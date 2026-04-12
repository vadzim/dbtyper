import type { PeekToken, SkipToken, SqlParserError, TokensList, TokenType } from "./sql-tokens.js"

/** Parsed marker for SQL that is skipped for the internal table model (no-op on apply). */
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
					? [SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>, Tokens]
					: PeekToken<Tokens> extends CurrentClosingBracket
						? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends ClosingBrackets
							? [SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>}`>, Tokens]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends EndToken
					? [SkippedStatement<PeekToken<Tokens>>, SkipToken<Tokens>]
					: PeekToken<Tokens> extends ""
						? [SqlParserError<"Token not found">, Tokens]
						: PeekToken<Tokens> extends ClosingBrackets
							? [SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>}`>, Tokens]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>

type ClosingBrackets = ")" | "]"
