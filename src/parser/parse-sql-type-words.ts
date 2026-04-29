import type { PeekToken, SkipToken, TokenIdent, TokensList } from "../../core/sql-tokens.ts"

export type CollectSqlTypeWords<Tokens extends TokensList, Acc extends readonly string[] = []> =
	PeekToken<Tokens> extends TokenIdent<infer W extends string>
		? CollectSqlTypeWords<SkipToken<Tokens>, [...Acc, W]>
		: [Tokens, Acc]

export type TypeWordsToString<A extends readonly string[]> = A extends readonly [
	infer H extends string,
	...infer T extends readonly string[],
]
	? T extends readonly []
		? H
		: `${H} ${TypeWordsToString<T>}`
	: ""

export type SqlJoinedToTs<Joined extends string, ScalarMap extends Record<string, unknown>> =
	Lowercase<Joined> extends infer K extends string ? (K extends keyof ScalarMap ? ScalarMap[K] : unknown) : unknown
