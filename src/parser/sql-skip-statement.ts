import type { PeekToken, SkipToken, SqlParserError, TokensList } from "./sql-tokens.js"
import type { IgnorableStatement } from "./sql-ignorable.js"

export type SkipStatement<Tokens extends TokensList, ClosingBracketsStack extends ClosingBrackets[] = []> =
	PeekToken<Tokens> extends "" | ";"
		? ClosingBracketsStack extends []
			? [IgnorableStatement, SkipToken<Tokens>]
			: [SqlParserError<"Unclosed statement">, Tokens]
		: PeekToken<Tokens> extends "("
			? SkipStatement<SkipToken<Tokens>, [")", ...ClosingBracketsStack]>
			: PeekToken<Tokens> extends "["
				? SkipStatement<SkipToken<Tokens>, ["]", ...ClosingBracketsStack]>
				: PeekToken<Tokens> extends ClosingBrackets
					? ClosingBracketsStack extends [PeekToken<Tokens>, ...infer Tail extends ClosingBrackets[]]
						? SkipStatement<SkipToken<Tokens>, Tail>
						: [SqlParserError<"Unmatched closing bracket">, Tokens]
					: SkipStatement<SkipToken<Tokens>, ClosingBracketsStack>

type ClosingBrackets = ")" | "]"
