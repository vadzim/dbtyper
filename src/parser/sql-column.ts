import type { ReadExpectedToken, ReadFirstParenGroup, StripIdentifierQuotes } from "./sql-primitives.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, ParseSqlTokens } from "../../core/sql-tokens.ts"

type SqlScalarTypeToTs<T extends string> = T extends
	| "int"
	| "integer"
	| "smallint"
	| "bigint"
	| "int2"
	| "int4"
	| "int8"
	| "smallserial"
	| "serial"
	| "bigserial"
	| "serial2"
	| "serial4"
	| "serial8"
	| "float"
	| "double"
	| "float4"
	| "float8"
	| "real"
	| "decimal"
	| "numeric"
	| "money"
	? number
	: T extends "boolean" | "bool"
		? boolean
		: T extends "date" | "timestamp" | "time" | "timetz" | "timestamptz" | "interval"
			? Date
			: T extends "bytea"
				? Uint8Array
				: T extends "json" | "jsonb"
					? unknown
					: T extends
								| "point"
								| "line"
								| "lseg"
								| "box"
								| "path"
								| "polygon"
								| "circle"
								| "int4range"
								| "int8range"
								| "numrange"
								| "tsrange"
								| "tstzrange"
								| "daterange"
								| "int4multirange"
								| "int8multirange"
								| "nummultirange"
								| "tsmultirange"
								| "tstzmultirange"
								| "datemultirange"
						? unknown
						: string

type ColumnDef = {
	name: string
	type: unknown
	nullable: boolean
}

type ReadOptionalTypeParams<Tokens extends TokensList> =
	PeekToken<Tokens> extends "("
		? ReadFirstParenGroup<Tokens> extends [infer Rest extends TokensList, infer _Inner extends string]
			? [Rest, true]
			: never
		: [Tokens, false]

type ReadIsArray<Tokens extends TokensList> =
	PeekToken<Tokens> extends "["
		? ReadExpectedToken<SkipToken<Tokens>, "]", "Expected ] after ["> extends [
				infer Rest extends TokensList,
				infer Ok,
			]
			? Ok extends true
				? [Rest, true]
				: [Rest, false]
			: never
		: [Tokens, false]

type ScanForNotNull<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [Tokens, false]
		: PeekToken<Tokens> extends "," | ")" | ";"
			? [Tokens, false]
			: PeekToken<Tokens> extends "not"
				? ReadExpectedToken<SkipToken<Tokens>, "null", "Expected NULL after NOT"> extends [
						infer RestNull extends TokensList,
						infer OkNull,
					]
					? OkNull extends true
						? [RestNull, true]
						: ScanForNotNull<RestNull>
					: never
				: ScanForNotNull<SkipToken<Tokens>>

type ParseColumnAfterTypeTok<Tokens extends TokensList, ColNameRaw extends string, TypeRaw extends string> =
	ReadOptionalTypeParams<Tokens> extends [infer RestParams extends TokensList, infer _HasTypeParams extends boolean]
		? ReadIsArray<RestParams> extends [infer RestArray extends TokensList, infer IsArr extends boolean]
			? ScanForNotNull<RestArray> extends [
					infer RestAfterNullable extends TokensList,
					infer FoundNotNull extends boolean,
				]
				? [
						RestAfterNullable,
						{
							name: StripIdentifierQuotes<ColNameRaw>
							type: IsArr extends true
								? SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>[]
								: SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>
							nullable: FoundNotNull extends true ? false : true
						},
					]
				: never
			: never
		: never

type ParseColumnRestAfterName<Tokens extends TokensList, ColNameRaw extends string> =
	PeekToken<Tokens> extends infer TypeRaw extends string
		? TypeRaw extends "" | ")" | "," | ";"
			? [Tokens, SqlParserError<"Invalid column definition">]
			: ParseColumnAfterTypeTok<SkipToken<Tokens>, ColNameRaw, TypeRaw>
		: never

type ParseColumnFromBuffer<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer ColNameRaw extends string
		? ColNameRaw extends ""
			? [Tokens, SqlParserError<"Invalid column definition">]
			: ParseColumnRestAfterName<SkipToken<Tokens>, ColNameRaw>
		: never

type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"]
}

type Merge<A, B> = A & B

export type AddColumn<Tokens extends TokensList, Row, Names extends string> =
	ParseColumnFromBuffer<Tokens> extends [infer Rest extends TokensList, infer F]
		? F extends ColumnDef
			? [
					Rest,
					{
						row: Merge<Row, ColumnToRecord<F>>
						names: Names | F["name"]
						error: never
					},
				]
			: [
					Rest,
					{
						row: Row
						names: Names
						error: SqlParserError<"Invalid column definition">
					},
				]
		: never
