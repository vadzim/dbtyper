import type { EmptyTokenList, ParseSqlTokens, ReadToken, TokensList, TokenType } from "../../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../../src/sql-parser-error.ts"

export type TestTokensS<S extends string> = TestTokensL<ParseSqlTokens<S>>[1]

export type TestTokensL<S extends TokensList, Acc extends unknown[] = []> = Acc["length"] extends 100
	? [EmptyTokenList, Acc]
	: S extends EmptyTokenList
		? [EmptyTokenList, Acc]
		: ReadToken<S> extends [infer R extends TokensList, infer P]
			? P extends TokenType<infer _kind, infer Value>
				? TestTokensL<R, [...Acc, P]>
				: P extends SqlParserError<infer Msg extends string>
					? TestTokensL<R, [...Acc, P]>
					: never
			: never
