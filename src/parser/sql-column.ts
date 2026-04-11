import type { ReadFirstParenGroup, StripIdentifierQuotes, TrimLeft } from "./sql-parse-primitives.js"
import type { BufferLike, BufferPayload, InitBuffer, ReadToken, SqlParseError } from "./sql-tokens.js"

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
	ReadToken<B> extends ["(", infer _]
		? ReadFirstParenGroup<B> extends [infer _, infer R extends BufferLike]
			? R
			: B
		: B

/** Checks whether the buffer starts with `[]` (array suffix). Returns `[isArray, rest]`. */
type ReadIsArray<B extends BufferLike> =
	TrimLeft<BufferPayload<B>> extends `[]${infer Rest}` ? [true, InitBuffer<Rest>] : [false, B]

/** Scans remaining tokens for a `NOT NULL` sequence. Returns `true` if found. */
type ScanForNotNull<B extends BufferLike> =
	ReadToken<B> extends [infer T extends string, infer R extends BufferLike]
		? T extends ""
			? false
			: T extends "not"
				? ReadToken<R> extends ["null", infer _]
					? true
					: ScanForNotNull<R>
				: ScanForNotNull<R>
		: false

/**
 * Parses a column definition from a buffer.
 * Returns `[{ name, type, nullable }, rest]` on success,
 * or `[SqlParseError, B]` on failure.
 */
type ParseColumnFromBuffer<B extends BufferLike> =
	ReadToken<B> extends [infer ColNameRaw extends string, infer RestName extends BufferLike]
		? ColNameRaw extends ""
			? [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]
			: ReadToken<RestName> extends [infer TypeRaw extends string, infer RestType extends BufferLike]
				? TypeRaw extends ""
					? [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]
					: SkipOptionalTypeParams<RestType> extends infer RestParams extends BufferLike
						? ReadIsArray<RestParams> extends [
								infer IsArr extends boolean,
								infer RestArray extends BufferLike,
							]
							? [
									{
										name: StripIdentifierQuotes<ColNameRaw>
										type: IsArr extends true
											? SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>[]
											: SqlScalarTypeToTs<StripIdentifierQuotes<TypeRaw>>
										nullable: ScanForNotNull<RestArray> extends true ? false : true
									},
									RestArray,
								]
							: [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]
						: [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]
				: [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]
		: [SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>, B]

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
				error: SqlParseError<`Invalid column definition: ${BufferPayload<B>}`>
				rest: B
			}
