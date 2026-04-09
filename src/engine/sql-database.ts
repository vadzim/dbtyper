import type { FkColumnPair, ForeignRefMeta, ValidateFkReferencedColumnPairs } from "../parser/sql-constraints-fk.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"

export type SqlDatabaseLike = {
	readonly kind: "database"
	readonly defaultSchema: string
	readonly schemas: Record<string, Record<string, unknown>>
}

export type SqlEmptyDatabase<DefaultSchema extends string = "public"> = {
	readonly kind: "database"
	readonly defaultSchema: DefaultSchema
	readonly schemas: {}
}

export type SqlDatabase<
	Schemas extends Record<string, unknown>,
	DefaultSchema extends string = "public",
	Migrations extends Record<string, string> = {},
> = [ExtractSchemaErrors<Schemas>] extends [never]
	? ValidateDatabaseRefs<ExtractValidSchemas<Schemas>, DefaultSchema> extends infer E
		? [E] extends [never]
			? {
					readonly kind: "database"
					readonly defaultSchema: DefaultSchema
					readonly schemas: {
						[K in keyof ExtractValidSchemas<Schemas>]: ExtractValidSchemas<Schemas>[K]["tables"]
					}
					readonly migrations: Migrations
				}
			: E
		: SqlParseError<"Internal database builder error">
	: ExtractSchemaErrors<Schemas>

type ValidateRefColumnPairs<Pairs extends readonly FkColumnPair[], TargetRow> =
	ValidateFkReferencedColumnPairs<Pairs, Extract<keyof TargetRow, string>> extends true
		? never
		: ValidateFkReferencedColumnPairs<Pairs, Extract<keyof TargetRow, string>>

type SqlSchemaLike = {
	readonly kind: "schema"
	readonly tables: Record<string, unknown>
	readonly __refs: ForeignRefMeta | undefined
}

type ResolveRefSchema<R extends ForeignRefMeta, DefaultSchema extends string> = [R["toSchema"]] extends [undefined]
	? DefaultSchema
	: Extract<R["toSchema"], string>

type ValidateDatabaseRef<
	R extends ForeignRefMeta | undefined,
	Schemas extends Record<string, SqlSchemaLike>,
	DefaultSchema extends string,
> = [R] extends [undefined]
	? never
	: R extends {
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
