import type { ReadExpectedToken, StripIdentifierQuotes } from "./sql-primitives.ts"
import type { TokensList, PeekToken, SkipToken, SqlParserError, TokenType } from "../../core/sql-tokens.ts"
import type { SkipStatement } from "./skip-statement.ts"

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

export type ColumnFactsEntry = {
	default?: true
	check?: true
	generated?: true | { mode: "stored" | "virtual" }
}

type ColumnDef = {
	name: string
	type: unknown
	nullable: boolean
	facts: Record<string, unknown>
}

type ReadOptionalTypeParams<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"(">
		? SkipStatement<SkipToken<Tokens>, ")"> extends [infer Rest extends TokensList, infer SkipResult]
			? SkipResult extends SqlParserError<string>
				? [Rest, SkipResult]
				: [Rest, true]
			: never
		: [Tokens, false]

type ReadIsArray<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"[">
		? ReadExpectedToken<SkipToken<Tokens>, "]", "Expected ] after ["> extends [
				infer Rest extends TokensList,
				infer Ok,
			]
			? Ok extends true
				? [Rest, true]
				: [Rest, false]
			: never
		: [Tokens, false]

type SetGeneratedMode<Facts extends Record<string, unknown>, Mode extends "stored" | "virtual"> = Omit<Facts, "generated"> & {
	generated: { mode: Mode }
}

type ScanForColumnFacts<
	Tokens extends TokensList,
	Nullable extends boolean = true,
	Facts extends Record<string, unknown> = {},
	ParenStack extends ")"[] = [],
> =
	PeekToken<Tokens> extends TokenType<"">
		? [Tokens, { nullable: Nullable; facts: Facts }]
		: ParenStack extends []
			? PeekToken<Tokens> extends TokenType<"," | ")" | ";">
				? [Tokens, { nullable: Nullable; facts: Facts }]
				: PeekToken<Tokens> extends TokenType<"(">
						? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, [")"]>
					: PeekToken<Tokens> extends TokenType<"not">
						? ReadExpectedToken<SkipToken<Tokens>, "null", "Expected NULL after NOT"> extends [
								infer RestNull extends TokensList,
								infer OkNull,
							]
							? OkNull extends true
								? ScanForColumnFacts<RestNull, false, Facts, ParenStack>
								: ScanForColumnFacts<RestNull, Nullable, Facts, ParenStack>
							: never
						: PeekToken<Tokens> extends TokenType<"null">
							? ScanForColumnFacts<SkipToken<Tokens>, true, Facts, ParenStack>
						: PeekToken<Tokens> extends TokenType<"default">
								? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts & { default: true }, ParenStack>
							: PeekToken<Tokens> extends TokenType<"check">
									? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts & { check: true }, ParenStack>
									: PeekToken<Tokens> extends TokenType<"generated">
										? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts & { generated: true }, ParenStack>
										: PeekToken<Tokens> extends TokenType<"stored">
											? ScanForColumnFacts<
													SkipToken<Tokens>,
													Nullable,
													SetGeneratedMode<Facts, "stored">,
													ParenStack
												>
											: PeekToken<Tokens> extends TokenType<"virtual">
												? ScanForColumnFacts<
														SkipToken<Tokens>,
														Nullable,
														SetGeneratedMode<Facts, "virtual">,
														ParenStack
													>
												: PeekToken<Tokens> extends TokenType<"always" | "as">
													? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, ParenStack>
													: ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, ParenStack>
			: PeekToken<Tokens> extends TokenType<"(">
				? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, [")", ...ParenStack]>
				: PeekToken<Tokens> extends TokenType<")">
					? ParenStack extends [infer Current extends ")", ...infer Tail extends ")"[]]
						? PeekToken<Tokens> extends TokenType<Current>
							? ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, Tail>
							: ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, Tail>
						: [Tokens, { nullable: Nullable; facts: Facts }]
					: ScanForColumnFacts<SkipToken<Tokens>, Nullable, Facts, ParenStack>

type ParseColumnAfterTypeTok<Tokens extends TokensList, ColNameRaw extends string, TypeRaw extends string> =
	ReadOptionalTypeParams<Tokens> extends [infer RestParams extends TokensList, infer _HasTypeParams extends boolean]
		? ReadIsArray<RestParams> extends [infer RestArray extends TokensList, infer IsArr extends boolean]
			? ScanForColumnFacts<RestArray> extends [
						infer RestAfterNullable extends TokensList,
						infer ColumnTail extends { nullable: boolean; facts: Record<string, unknown> },
					]
					? [
							RestAfterNullable,
							{
								name: StripIdentifierQuotes<TokenType<ColNameRaw>>
								type: IsArr extends true
									? SqlScalarTypeToTs<StripIdentifierQuotes<TokenType<TypeRaw>>>[]
									: SqlScalarTypeToTs<StripIdentifierQuotes<TokenType<TypeRaw>>>
								nullable: ColumnTail["nullable"]
								facts: ColumnTail["facts"]
							},
						]
					: never
				: never
		: never

type ParseColumnRestAfterName<Tokens extends TokensList, ColNameRaw extends string> =
	PeekToken<Tokens> extends TokenType<infer TypeRaw extends string>
		? TypeRaw extends "" | ")" | "," | ";"
			? [Tokens, SqlParserError<"Invalid column definition">]
			: ParseColumnAfterTypeTok<SkipToken<Tokens>, ColNameRaw, TypeRaw>
		: never

type ParseColumnFromBuffer<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<infer ColNameRaw extends string>
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
						facts: keyof F["facts"] extends never ? never : { [K in F["name"]]: F["facts"] }
					},
				]
		: [
				Rest,
				{
					row: Row
					names: Names
					error: SqlParserError<"Invalid column definition">
					facts: never
				},
			]
	: never
