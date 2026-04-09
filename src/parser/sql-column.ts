import type { SqlParseError } from "../sql-types.js";
import type { ReadIdentifier, ReadWord, StripIdentifierQuotes, Trim, ToLower } from "./sql-parse-primitives.js";

type NormalizeTypeToken<S extends string> = ToLower<Trim<S>> extends `${infer Base}(${string}` ? Trim<Base> : ToLower<Trim<S>>;
type StripArraySuffix<T extends string> = T extends `${infer Base}[]` ? StripArraySuffix<Base> : T;
type StripSchemaPrefix<T extends string> = T extends `${string}.${infer Name}` ? Name : T;
type NormalizePgTypeToken<T extends string> = StripSchemaPrefix<StripArraySuffix<NormalizeTypeToken<T>>>;
type IsArrayType<T extends string> = NormalizeTypeToken<T> extends `${string}[]` ? true : false;
type SqlScalarTypeToTs<T extends string> = NormalizePgTypeToken<T> extends
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
	: NormalizePgTypeToken<T> extends "boolean" | "bool"
		? boolean
		: NormalizePgTypeToken<T> extends "date" | "timestamp" | "time" | "timetz" | "timestamptz" | "interval"
			? Date
			: NormalizePgTypeToken<T> extends "bytea"
				? Uint8Array
				: NormalizePgTypeToken<T> extends "json" | "jsonb"
					? unknown
					: NormalizePgTypeToken<T> extends
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
						: string;
type SqlTypeToTs<T extends string> = IsArrayType<T> extends true ? SqlScalarTypeToTs<T>[] : SqlScalarTypeToTs<T>;

type IsNullable<ColumnSpec extends string> = ToLower<ColumnSpec> extends `${string} not null${string}` ? false : true;
type ParseColumn<Col extends string> = ReadIdentifier<Trim<Col>> extends [infer ColName extends string, infer Rest extends string]
	? ReadWord<Trim<Rest>> extends [infer SqlT extends string, infer AfterType extends string]
		? {
				name: StripIdentifierQuotes<ColName>;
				type: SqlTypeToTs<SqlT>;
				nullable: IsNullable<AfterType>;
			}
		: never
	: never;
type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"];
};
type Merge<A, B> = A & B;
export type Simplify<T> = { [K in keyof T]: T[K] };

export type AddColumn<Head extends string, Row, Names extends string> = ParseColumn<Head> extends infer C extends {
	name: string;
	type: unknown;
	nullable: boolean;
}
	? { row: Merge<Row, ColumnToRecord<C>>; names: Names | C["name"]; error: never }
	: { row: Row; names: Names; error: SqlParseError<`Invalid column definition: ${Trim<Head>}`> };
