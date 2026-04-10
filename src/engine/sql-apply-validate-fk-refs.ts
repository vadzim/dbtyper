import type { SqlCreateTableLike } from "../parser/sql-create-table.js"
import type { ForeignRefMeta, ValidateFkReferencedColumnPairs } from "../parser/sql-constraints-fk.js"
import type { Buffer, SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "./sql-database.js"

export type ValidateCreateTableFkRefs<
	Db extends SqlDatabaseLike,
	Create extends SqlCreateTableLike,
	NewSchema extends string,
	NewTable extends string,
> = Create["refs"] extends undefined ? never : ValidateFkRefsUnion<Db, Create, NewSchema, NewTable, Create["refs"]>

type ResolveFkTargetSchema<R extends ForeignRefMeta, DbDefault extends string> = [R["toSchema"]] extends [undefined]
	? DbDefault
	: Extract<R["toSchema"], string>

type ValidateFkRefsUnion<
	Db extends SqlDatabaseLike,
	Create extends SqlCreateTableLike,
	NewSchema extends string,
	NewTable extends string,
	Refs,
> = Refs extends ForeignRefMeta ? ValidateOneCreateTableFkRef<Db, Create, NewSchema, NewTable, Refs> : never

type IsSelfRef<
	NewSchema extends string,
	NewTable extends string,
	TargetSchema extends string,
	R extends ForeignRefMeta,
> = TargetSchema extends NewSchema
	? NewSchema extends TargetSchema
		? R["toTable"] extends NewTable
			? NewTable extends R["toTable"]
				? true
				: false
			: false
		: false
	: false

type UnknownRefTableError<R extends ForeignRefMeta, TargetSchema extends string, NewSchema extends string> = [
	R["toSchema"],
] extends [undefined]
	? TargetSchema extends NewSchema
		? NewSchema extends TargetSchema
			? SqlParseError<`Unknown referenced table "${R["toTable"]}" in schema`>
			: SqlParseError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
		: SqlParseError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
	: SqlParseError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>

type ValidateFkTargetColumns<Row, Pairs extends ForeignRefMeta["columnPairs"]> =
	ValidateFkReferencedColumnPairs<Pairs, Extract<keyof Row, string>> extends [infer R, infer _ extends Buffer]
		? R extends true
			? never
			: R
		: never

type ValidateOneCreateTableFkRef<
	Db extends SqlDatabaseLike,
	Create extends SqlCreateTableLike,
	NewSchema extends string,
	NewTable extends string,
	R extends ForeignRefMeta,
> =
	ResolveFkTargetSchema<R, Db["defaultSchema"]> extends infer TargetSchema extends string
		? IsSelfRef<NewSchema, NewTable, TargetSchema, R> extends true
			? ValidateFkTargetColumns<Create["row"], R["columnPairs"]>
			: TargetSchema extends keyof Db["schemas"]
				? R["toTable"] extends keyof Db["schemas"][TargetSchema]
					? ValidateFkTargetColumns<Db["schemas"][TargetSchema][R["toTable"]], R["columnPairs"]>
					: UnknownRefTableError<R, TargetSchema, NewSchema>
				: SqlParseError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParseError<"Internal FK target schema resolution error">
