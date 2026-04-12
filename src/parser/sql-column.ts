import type { ReadExpectedToken, ReadFirstParenGroup, StripIdentifierQuotes } from "./sql-primitives.js"
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
type SkipOptionalTypeParams<Tokens extends TokensList> =
	PeekToken<Tokens> extends "("
		? ReadFirstParenGroup<Tokens> extends [infer _, infer R extends TokensList]
			? R
			: Tokens
		: Tokens

/** Checks whether the buffer starts with `[]` (array suffix). Returns `[isArray, rest]`. */
type ReadIsArray<Tokens extends TokensList> =
	PeekToken<Tokens> extends "["
		? ReadExpectedToken<SkipToken<Tokens>, "]", "Expected ] after ["> extends [true, infer R extends TokensList]
			? [true, R]
			: [false, Tokens]
		: [false, Tokens]

/**
 * Scans for a `NOT NULL` token pair from `Tokens`. Returns `[found, rest]`:
 * - `[true, R]` — `R` is the buffer immediately after the `null` token.
 * - `[false, Start]` — no such pair found; `Start` is the buffer at the beginning of this scan
 *   (call with `Start` defaulted to `Tokens` so callers keep the cursor when nothing was consumed).
 */
type ScanForNotNullWithRest<Tokens extends TokensList, Start extends TokensList = Tokens> =
	PeekToken<Tokens> extends ""
		? [false, Start]
		: PeekToken<Tokens> extends "," | ")"
			? [false, Start]
			: PeekToken<Tokens> extends "not"
				? ReadExpectedToken<SkipToken<Tokens>, "null", "Expected NULL after NOT"> extends [
						true,
						infer AfterNull extends TokensList,
					]
					? [true, AfterNull]
					: ScanForNotNullWithRest<SkipToken<Tokens>, Start>
				: ScanForNotNullWithRest<SkipToken<Tokens>, Start>

/**
 * Parses a column definition from a buffer.
 * Returns `[{ name, type, nullable }, rest]` on success,
 * or `[SqlParserError, Tokens]` on failure.
 */
type ParseColumnFromBuffer<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer ColNameRaw extends string
		? ColNameRaw extends ""
			? [SqlParserError<"Invalid column definition">, Tokens]
			: SkipToken<Tokens> extends infer AfterName extends TokensList
				? PeekToken<AfterName> extends infer TypeRaw extends string
					? TypeRaw extends "" | ")" | "," | ";"
						? [SqlParserError<"Invalid column definition">, Tokens]
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
									: [SqlParserError<"Invalid column definition">, Tokens]
								: [SqlParserError<"Invalid column definition">, Tokens]
							: [SqlParserError<"Invalid column definition">, Tokens]
					: [SqlParserError<"Invalid column definition">, Tokens]
				: never
		: never

type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"]
}

type Merge<A, B> = A & B

export type AddColumn<Tokens extends TokensList, Row, Names extends string> =
	ParseColumnFromBuffer<Tokens> extends [
		infer C extends { name: string; type: unknown; nullable: boolean },
		infer Rest extends TokensList,
	]
		? { row: Merge<Row, ColumnToRecord<C>>; names: Names | C["name"]; error: never; rest: Rest }
		: {
				row: Row
				names: Names
				error: SqlParserError<"Invalid column definition">
				rest: Tokens
			}
