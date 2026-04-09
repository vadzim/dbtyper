import type {
	FkColumnPair,
	ForeignRefMeta,
	SqlCreateTableLike,
	ValidateFkReferencedColumnPairs,
} from "./parser/sql-create-table.js"
import type { SqlParseError } from "./sql-types.js"

/** One entry in `SqlSchema<[…]>`: a parsed table or a whole-table parse error from `SqlCreateTable`. */
export type SqlSchemaTableInput = SqlCreateTableLike | SqlParseError<string>

type Simplify<T> = { [K in keyof T]: T[K] }

type ValidateRefColumnPairs<Pairs extends readonly FkColumnPair[], TargetRow> = ValidateFkReferencedColumnPairs<
	Pairs,
	Extract<keyof TargetRow, string>
> extends true
	? never
	: ValidateFkReferencedColumnPairs<Pairs, Extract<keyof TargetRow, string>>

type ValidateIntraSchemaRefs<Refs extends ForeignRefMeta, Tables> = Refs extends infer R
	? R extends ForeignRefMeta
		? R extends {
				columnPairs: infer Pairs extends readonly FkColumnPair[]
				toSchema: infer TS
				toTable: infer TT extends string
		  }
			? [TS] extends [never]
				? TT extends keyof Tables
					? ValidateRefColumnPairs<Pairs, Tables[TT]>
					: SqlParseError<`Unknown referenced table "${TT}" in schema`>
				: never
			: never
		: never
	: never

type SqlSchemaBuildInternal<
	Tables extends readonly SqlSchemaTableInput[],
	Acc,
	Seen extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> = Tables extends readonly [infer Head, ...infer Tail extends readonly SqlSchemaTableInput[]]
	? Head extends SqlParseError<string>
		? SqlSchemaBuildInternal<Tail, Acc, Seen, Error | Head, Refs>
		: Head extends SqlCreateTableLike
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
								| Refs
								| (Head["__refs"] extends infer FR extends ForeignRefMeta ? Omit<FR, "from"> & { from: Name } : never)
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
		: SqlSchemaBuildInternal<Tail, Acc, Seen, Error | SqlParseError<"Invalid schema table entry">, Refs>
	: { tables: Simplify<Acc>; error: Error | ValidateIntraSchemaRefs<Refs, Simplify<Acc>>; refs: Refs }

export type SqlSchema<Tables extends readonly SqlSchemaTableInput[]> = SqlSchemaBuildInternal<
	Tables,
	{},
	never
> extends infer Built
	? Built extends { tables: infer T; error: infer E; refs: infer R }
		? [E] extends [never]
			? {
					readonly kind: "schema"
					readonly tables: T
					readonly __refs: Extract<R, ForeignRefMeta>
			  }
			: E
		: SqlParseError<"Internal schema builder error">
	: SqlParseError<"Internal schema builder error">

type SqlSchemaLike = {
	readonly kind: "schema"
	readonly tables: Record<string, unknown>
	readonly __refs: ForeignRefMeta
}

type ResolveRefSchema<R extends ForeignRefMeta, DefaultSchema extends string> = [R["toSchema"]] extends [never]
	? DefaultSchema
	: Extract<R["toSchema"], string>

type ValidateDatabaseRef<
	R extends ForeignRefMeta,
	Schemas extends Record<string, SqlSchemaLike>,
	DefaultSchema extends string,
> = R extends {
	columnPairs: infer Pairs extends readonly FkColumnPair[]
	toTable: infer TTab extends string
}
	? ResolveRefSchema<R, DefaultSchema> extends infer TargetSchema extends string
		? TargetSchema extends keyof Schemas
			? TTab extends keyof Schemas[TargetSchema]["tables"]
				? ValidateRefColumnPairs<Pairs, Schemas[TargetSchema]["tables"][TTab]>
				: SqlParseError<`Unknown referenced table "${TargetSchema}.${TTab}" in database`>
			: SqlParseError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParseError<"Internal database reference resolver error">
	: SqlParseError<"Internal database reference resolver error">

type ValidateDatabaseRefs<Schemas extends Record<string, SqlSchemaLike>, DefaultSchema extends string> = {
	[K in keyof Schemas]: ValidateDatabaseRef<Schemas[K]["__refs"], Schemas, DefaultSchema>
}[keyof Schemas]

type ExtractSchemaErrors<Schemas extends Record<string, unknown>> = {
	[K in keyof Schemas]: Schemas[K] extends SqlParseError<string> ? Schemas[K] : never
}[keyof Schemas]

type ExtractValidSchemas<Schemas extends Record<string, unknown>> = {
	[K in keyof Schemas as Schemas[K] extends SqlSchemaLike ? K : never]: Extract<Schemas[K], SqlSchemaLike>
}

export type SqlDatabase<Schemas extends Record<string, unknown>, DefaultSchema extends string = "public"> = [
	ExtractSchemaErrors<Schemas>,
] extends [never]
	? ValidateDatabaseRefs<ExtractValidSchemas<Schemas>, DefaultSchema> extends infer E
		? [E] extends [never]
			? {
					readonly kind: "database"
					readonly schemas: {
						[K in keyof ExtractValidSchemas<Schemas>]: ExtractValidSchemas<Schemas>[K]["tables"]
					}
			  }
			: E
		: SqlParseError<"Internal database builder error">
	: ExtractSchemaErrors<Schemas>
