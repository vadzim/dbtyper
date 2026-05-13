import type {
	EmptyTokenList,
	CreateParserMonad,
	PeekToken,
	SkipToken,
	ParserMonad,
} from "../../src/lexer/parser-monad.ts"
import type { DbtyperErrorShape } from "../../src/dbtyper-error.ts"
import type { TokenType } from "../../src/lexer/sql-lexer.ts"

export type TestTokensS<S extends string> = TestTokensL<CreateParserMonad<S>>[1]

export type TestTokensL<S extends ParserMonad, Acc extends unknown[] = []> = Acc["length"] extends 100
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
