import type { ReadExpectedToken, ReadFirstParenGroup, StripIdentifierQuotes } from "./sql-parse-primitives.js"
import type { TokensList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

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

/** Skips optional `(size)` type parameters, e.g. `varchar(255)`. Returns the rest buffer. */
type SkipOptionalTypeParams<B extends TokensList> =
	PeekToken<B> extends "(" ? (ReadFirstParenGroup<B> extends [infer _, infer R extends TokensList] ? R : B) : B

/** Checks whether the buffer starts with `[]` (array suffix). Returns `[isArray, rest]`. */
type ReadIsArray<B extends TokensList> =
	PeekToken<B> extends "["
		? ReadExpectedToken<SkipToken<B>, "]", "Expected ] after ["> extends [true, infer R extends TokensList]
			? [true, R]
			: [false, B]
		: [false, B]

/**
 * Scans for a `NOT NULL` token pair from `B`. Returns `[found, rest]`:
 * - `[true, R]` — `R` is the buffer immediately after the `null` token.
 * - `[false, Start]` — no such pair found; `Start` is the buffer at the beginning of this scan
 *   (call with `Start` defaulted to `B` so callers keep the cursor when nothing was consumed).
 */
type ScanForNotNullWithRest<B extends TokensList, Start extends TokensList = B> =
	PeekToken<B> extends ""
		? [false, Start]
		: PeekToken<B> extends "," | ")"
			? [false, Start]
			: PeekToken<B> extends "not"
				? ReadExpectedToken<SkipToken<B>, "null", "Expected NULL after NOT"> extends [
						true,
						infer AfterNull extends TokensList,
					]
					? [true, AfterNull]
					: ScanForNotNullWithRest<SkipToken<B>, Start>
				: ScanForNotNullWithRest<SkipToken<B>, Start>

/**
 * Parses a column definition from a buffer.
 * Returns `[{ name, type, nullable }, rest]` on success,
 * or `[SqlParserError, B]` on failure.
 */
type ParseColumnFromBuffer<B extends TokensList> =
	PeekToken<B> extends infer ColNameRaw extends string
		? ColNameRaw extends ""
			? [SqlParserError<"Invalid column definition">, B]
			: SkipToken<B> extends infer AfterName extends TokensList
				? PeekToken<AfterName> extends infer TypeRaw extends string
					? TypeRaw extends "" | ")" | "," | ";"
						? [SqlParserError<"Invalid column definition">, B]
						: SkipOptionalTypeParams<SkipToken<AfterName>> extends infer RestParams extends TokensList
							? ReadIsArray<RestParams> extends [
									infer IsArr extends boolean,
									infer RestArray extends TokensList,
								]
								? ScanForNotNullWithRest<RestArray> extends [
										infer FoundNotNull extends boolean,
										infer RestAfterNullable extends TokensList,
									]
									? [
											{
												name: StripIdentifierQuotes<ColNameRaw>
												type: IsArr extends true
													? SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>[]
													: SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>
												nullable: FoundNotNull extends true ? false : true
											},
											RestAfterNullable,
										]
									: [SqlParserError<"Invalid column definition">, B]
								: [SqlParserError<"Invalid column definition">, B]
							: [SqlParserError<"Invalid column definition">, B]
					: [SqlParserError<"Invalid column definition">, B]
				: never
		: never

type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"]
}

type Merge<A, B> = A & B

export type AddColumn<B extends TokensList, Row, Names extends string> =
	ParseColumnFromBuffer<B> extends [
		infer C extends { name: string; type: unknown; nullable: boolean },
		infer Rest extends TokensList,
	]
		? { row: Merge<Row, ColumnToRecord<C>>; names: Names | C["name"]; error: never; rest: Rest }
		: {
				row: Row
				names: Names
				error: SqlParserError<"Invalid column definition">
				rest: B
			}
