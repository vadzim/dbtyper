import type { PeekToken, SkipToken, SqlParserError, TokensList } from "./sql-tokens.js"

/** Parsed marker for SQL that is skipped for the internal table model (no-op on apply). */
export type SkippedStatement = {
	readonly kind: "skipped-statement"
}

export type SkipStatement<
	Tokens extends TokensList,
	EndToken = "" | ";",
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends EndToken
		? ClosingBracketsStack extends []
			? [SkippedStatement, SkipToken<Tokens>]
			: [SqlParserError<"Unclosed statement">, Tokens]
		: PeekToken<Tokens> extends ""
			? [SqlParserError<"Token not found">, Tokens]
			: PeekToken<Tokens> extends "("
				? SkipStatement<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
				: PeekToken<Tokens> extends "["
					? SkipStatement<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
					: PeekToken<Tokens> extends ClosingBrackets
						? ClosingBracketsStack extends [PeekToken<Tokens>, ...infer Tail extends ClosingBrackets[]]
							? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
							: [SqlParserError<"Unmatched closing bracket">, Tokens]
						: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>

type ClosingBrackets = ")" | "]"
