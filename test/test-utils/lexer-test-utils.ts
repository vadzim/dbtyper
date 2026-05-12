import type {
	EmptyTokenList,
	ParseSqlTokens,
	PeekToken,
	SkipToken,
	TokensList,
	TokenType,
} from "../../src/lexer/sql-tokens.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

export type TestTokensS<S extends string> = TestTokensL<ParseSqlTokens<S>>[1]

export type TestTokensL<S extends TokensList, Acc extends unknown[] = []> = Acc["length"] extends 100
	? [EmptyTokenList, Acc]
	: S extends EmptyTokenList
		? [EmptyTokenList, Acc]
		: PeekToken<S> extends infer P
			? P extends TokenType<infer _kind, infer _Value>
				? TestTokensL<SkipToken<S>, [...Acc, P]>
				: P extends DbtyperErrorShape
					? TestTokensL<SkipToken<S>, [...Acc, P]>
					: never
			: never
