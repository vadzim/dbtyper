import type {
	ForeignRefMeta,
	SqlCreateTableLike,
	ValidateColumnRefs,
} from "./sql-create-table.js";
import type { SqlParseError } from "./sql-types.js";

type Simplify<T> = { [K in keyof T]: T[K] };

type ValidateRefColumns<Cols extends string, TargetRow> = ValidateColumnRefs<
	Cols,
	Extract<keyof TargetRow, string>
> extends true
	? never
	: ValidateColumnRefs<Cols, Extract<keyof TargetRow, string>>;

type ValidateIntraSchemaRefs<Refs extends ForeignRefMeta, Tables> = Refs extends infer R extends ForeignRefMeta
	? [R["toSchema"]] extends [never]
		? R["toTable"] extends keyof Tables
			? ValidateRefColumns<R["toColumns"], Tables[R["toTable"]]>
			: SqlParseError<`Unknown referenced table "${R["toTable"]}" in schema`>
		: never
	: never;

type SqlSchemaBuildInternal<
	Tables extends readonly SqlCreateTableLike[],
	Acc,
	Seen extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> = Tables extends readonly [infer Head extends SqlCreateTableLike, ...infer Tail extends readonly SqlCreateTableLike[]]
	? Head["name"] extends infer Name
		? Name extends SqlParseError<string>
			? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Name, Refs>
			: Name extends string
				? Name extends Seen
					? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | SqlParseError<`Duplicate table name: ${Name}`>, Refs>
					: Head["row"] extends infer Row
						? Row extends SqlParseError<string>
							? SqlSchemaBuildInternal<Tail, Acc, Seen | Name, Error | Row, Refs>
							: SqlSchemaBuildInternal<
									Tail,
									Acc & { [K in Name]: Row },
									Seen | Name,
									Error,
									Refs | (Head["__refs"] extends infer FR extends ForeignRefMeta ? Omit<FR, "from"> & { from: Name } : never)
							  >
						: SqlSchemaBuildInternal<Tail, Acc, Seen | Name, Error | SqlParseError<"Internal SQL parser error">, Refs>
				: SqlSchemaBuildInternal<
						Tail,
						Acc,
						Seen,
						Error | SqlParseError<"Expected a CREATE TABLE statement with a table name">,
						Refs
				  >
		: SqlSchemaBuildInternal<
				Tail,
				Acc,
				Seen,
				Error | SqlParseError<"Expected a CREATE TABLE statement with a table name">,
				Refs
		  >
	: { tables: Simplify<Acc>; error: Error | ValidateIntraSchemaRefs<Refs, Simplify<Acc>>; refs: Refs };

export type SqlSchema<Tables extends readonly SqlCreateTableLike[]> = SqlSchemaBuildInternal<
	Tables,
	{},
	never
> extends infer Built
	? Built extends { tables: infer T; error: infer E; refs: infer R }
		? [E] extends [never]
			? {
					readonly kind: "schema";
					readonly tables: T;
					readonly __refs: Extract<R, ForeignRefMeta>;
			  }
			: E
		: SqlParseError<"Internal schema builder error">
	: SqlParseError<"Internal schema builder error">;

type SqlSchemaLike = {
	readonly kind: "schema";
	readonly tables: Record<string, unknown>;
	readonly __refs: ForeignRefMeta;
};

type ValidateDatabaseRef<R extends ForeignRefMeta, Schemas extends Record<string, SqlSchemaLike>> = [R["toSchema"]] extends [never]
	? never
	: R["toSchema"] extends keyof Schemas
		? R["toTable"] extends keyof Schemas[R["toSchema"]]["tables"]
			? ValidateRefColumns<R["toColumns"], Schemas[R["toSchema"]]["tables"][R["toTable"]]>
			: SqlParseError<`Unknown referenced table "${R["toSchema"]}.${R["toTable"]}" in database`>
		: SqlParseError<`Unknown referenced schema "${R["toSchema"]}" in database`>;

type ValidateDatabaseRefs<Schemas extends Record<string, SqlSchemaLike>> = {
	[K in keyof Schemas]: ValidateDatabaseRef<Schemas[K]["__refs"], Schemas>;
}[keyof Schemas];

type ExtractSchemaErrors<Schemas extends Record<string, unknown>> = {
	[K in keyof Schemas]: Schemas[K] extends SqlParseError<string> ? Schemas[K] : never;
}[keyof Schemas];

type ExtractValidSchemas<Schemas extends Record<string, unknown>> = {
	[K in keyof Schemas as Schemas[K] extends SqlSchemaLike ? K : never]: Extract<Schemas[K], SqlSchemaLike>;
};

export type SqlDatabase<Schemas extends Record<string, unknown>> = [ExtractSchemaErrors<Schemas>] extends [never]
	? ValidateDatabaseRefs<ExtractValidSchemas<Schemas>> extends infer E
		? [E] extends [never]
			? {
					readonly kind: "database";
					readonly schemas: {
						[K in keyof ExtractValidSchemas<Schemas>]: ExtractValidSchemas<Schemas>[K]["tables"];
					};
			  }
			: E
		: SqlParseError<"Internal database builder error">
	: ExtractSchemaErrors<Schemas>;
