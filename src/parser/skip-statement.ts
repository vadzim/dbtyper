import type {
	PeekToken,
	SkipToken,
	SqlParserError,
	TokensList,
	TokenEot,
	TokenKey,
	TokenKind,
	TokenType,
} from "../../core/sql-tokens.ts"

export type SkippedStatement<Token extends TokenType<TokenKind, string> = TokenType<TokenKind, string>> = {
	kind: "skipped-statement"
	token: Token
}

export type SkipStatement<
	Tokens extends TokensList,
	EndToken extends TokenType<TokenKind, string> = TokenEot | TokenKey<";">,
	ClosingBracketsStack extends ClosingBrackets[] = [],
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipStatement<SkipToken<Tokens>, EndToken, [")", ...ClosingBracketsStack]>
		: PeekToken<Tokens> extends TokenKey<"[">
			? SkipStatement<SkipToken<Tokens>, EndToken, ["]", ...ClosingBracketsStack]>
			: ClosingBracketsStack extends [
						infer CurrentClosingBracket extends ClosingBrackets,
						...infer Tail extends ClosingBrackets[],
				  ]
				? PeekToken<Tokens> extends TokenEot
					? [Tokens, SqlParserError<`Closing bracket not found: ${CurrentClosingBracket}`>]
					: PeekToken<Tokens> extends TokenKey<CurrentClosingBracket>
						? SkipStatement<SkipToken<Tokens>, EndToken, Tail>
						: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
							? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
							: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
				: PeekToken<Tokens> extends infer EndTok
					? EndTok extends EndToken
						? [SkipToken<Tokens>, SkippedStatement<EndTok>]
						: PeekToken<Tokens> extends TokenEot
							? [Tokens, SqlParserError<"Token not found">]
							: PeekToken<Tokens> extends TokenKey<ClosingBrackets>
								? [Tokens, SqlParserError<`Unmatched closing bracket: ${PeekToken<Tokens>["value"]}`>]
								: SkipStatement<SkipToken<Tokens>, EndToken, ClosingBracketsStack>
					: never

type ClosingBrackets = ")" | "]"
