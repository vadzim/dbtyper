import type { PeekToken, SkipToken, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

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

/** Parse array suffix `[]` after a type name, returning the type with `[]` appended. */
export type ParseArraySuffix<Tokens extends TokensList, BaseType extends string> =
	PeekToken<Tokens> extends TokenKey<"[">
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? PeekToken<R1> extends TokenKey<"]">
				? SkipToken<R1> extends infer R2 extends TokensList
					? [R2, `${BaseType}[]`]
					: never
				: SkipFailedExpression<R1, SqlParserError<"Expected ] after [ in array type">>
			: never
		: [Tokens, BaseType]
