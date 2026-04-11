import type { ReadFirstParenGroup, StripIdentifierQuotes } from "./sql-parse-primitives.js"
import type { BufferLike, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

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
type SkipOptionalTypeParams<B extends BufferLike> =
	PeekToken<B> extends "("
		? ReadFirstParenGroup<B> extends [infer _, infer R extends BufferLike]
			? R
			: B
		: B

/** Checks whether the buffer starts with `[]` (array suffix). Returns `[isArray, rest]`. */
type ReadIsArray<B extends BufferLike> =
	PeekToken<B> extends "["
		? PeekToken<SkipToken<B>> extends "]"
			? [true, SkipToken<SkipToken<B>>]
			: [false, B]
		: [false, B]

/**
 * Scans for a `NOT NULL` token pair from `B`. Returns `[found, rest]`:
 * - `[true, R]` — `R` is the buffer immediately after the `null` token.
 * - `[false, Start]` — no such pair found; `Start` is the buffer at the beginning of this scan
 *   (call with `Start` defaulted to `B` so callers keep the cursor when nothing was consumed).
 */
type ScanForNotNullWithRest<
	B extends BufferLike,
	Start extends BufferLike = B,
> = PeekToken<B> extends ""
	? [false, Start]
	: PeekToken<B> extends "," | ")"
		? [false, Start]
		: PeekToken<B> extends "not"
			? PeekToken<SkipToken<B>> extends "null"
				? [true, SkipToken<SkipToken<B>>]
				: ScanForNotNullWithRest<SkipToken<B>, Start>
			: ScanForNotNullWithRest<SkipToken<B>, Start>

/**
 * Parses a column definition from a buffer.
 * Returns `[{ name, type, nullable }, rest]` on success,
 * or `[SqlParseError, B]` on failure.
 */
type ParseColumnFromBuffer<B extends BufferLike> =
	PeekToken<B> extends infer ColNameRaw extends string
		? ColNameRaw extends ""
			? [SqlParseError<"Invalid column definition">, B]
			: PeekToken<SkipToken<B>> extends infer TypeRaw extends string
				? TypeRaw extends "" | ")" | "," | ";"
					? [SqlParseError<"Invalid column definition">, B]
					: SkipOptionalTypeParams<SkipToken<SkipToken<B>>> extends infer RestParams extends BufferLike
						? ReadIsArray<RestParams> extends [
								infer IsArr extends boolean,
								infer RestArray extends BufferLike,
							]
							? ScanForNotNullWithRest<RestArray> extends [
									infer FoundNotNull extends boolean,
									infer RestAfterNullable extends BufferLike,
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
								: [SqlParseError<"Invalid column definition">, B]
							: [SqlParseError<"Invalid column definition">, B]
						: [SqlParseError<"Invalid column definition">, B]
				: never
		: never

type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"]
}

type Merge<A, B> = A & B

export type AddColumn<B extends BufferLike, Row, Names extends string> =
	ParseColumnFromBuffer<B> extends [
		infer C extends { name: string; type: unknown; nullable: boolean },
		infer Rest extends BufferLike,
	]
		? { row: Merge<Row, ColumnToRecord<C>>; names: Names | C["name"]; error: never; rest: Rest }
		: {
				row: Row
				names: Names
				error: SqlParseError<"Invalid column definition">
				rest: B
			}
