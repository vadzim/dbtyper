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

type SqlScalarTypeMap = {
	uuid: string
	text: string
	integer: number
	int: number
	bigint: bigint
	smallint: number
	boolean: boolean
	bool: boolean
	numeric: string
	decimal: string
	real: number
	float: number
	"double precision": number
	json: unknown
	jsonb: unknown
	date: string
	timestamp: string
	"timestamp with time zone": string
	"timestamp without time zone": string
	"time with time zone": string
	"time without time zone": string
	"character varying": string
	varchar: string
	char: string
}

export type SqlJoinedToTs<Joined extends string> =
	Lowercase<Joined> extends infer K extends string
		? K extends keyof SqlScalarTypeMap
			? SqlScalarTypeMap[K]
			: unknown
		: unknown
