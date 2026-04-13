import type { CreateTableStatement } from "../../parser/parse-create-table.js"
import type {
	ForeignRefMeta,
	IntraTableConstraintRef,
	ValidateColumnTupleRefs,
	ValidateFkLocalColumnPairs,
	ValidateFkReferencedColumnPairs,
} from "../../parser/sql-constraints-fk.js"
import type { SqlParserError } from "../../parser/sql-tokens.js"
import type { SqlDatabaseLike } from "../sql-database.js"

type NonTrue<Value> = Value extends true ? never : Value

type ValidateIntraConstraintsOnRow<
	Row,
	Intra extends readonly IntraTableConstraintRef[],
> = Intra extends readonly [infer Head extends IntraTableConstraintRef, ...infer Tail extends readonly IntraTableConstraintRef[]]
	? Head extends { readonly columns: infer Cols extends readonly string[] }
		? ValidateColumnTupleRefs<Cols, Extract<keyof Row, string>> extends infer V
			? V extends true
				? ValidateIntraConstraintsOnRow<Row, Tail>
				: V
			: never
		: never
	: never

type ValidateFkLocalsOnRow<Row, Refs> = [Refs] extends [undefined | never]
	? never
	: Refs extends ForeignRefMeta
		? NonTrue<ValidateFkLocalColumnPairs<Refs["columnPairs"], Extract<keyof Row, string>>>
		: never

/** PRIMARY KEY / UNIQUE / FOREIGN KEY local columns vs the new table row (apply-time). */
export type ValidateCreateTableLocalRefs<
	Row,
	Intra extends readonly IntraTableConstraintRef[],
	Refs,
> = ValidateIntraConstraintsOnRow<Row, Intra> extends infer E1
	? [E1] extends [never]
		? ValidateFkLocalsOnRow<Row, Refs>
		: E1
	: ValidateFkLocalsOnRow<Row, Refs>

export type ValidateCreateTableFkRefs<
	Db extends SqlDatabaseLike,
	Create extends CreateTableStatement,
	NewSchema extends string,
	NewTable extends string,
> = Create["refs"] extends undefined ? never : ValidateFkRefsUnion<Db, Create, NewSchema, NewTable, Create["refs"]>

type ResolveFkTargetSchema<R extends ForeignRefMeta, DbDefault extends string> = [R["toSchema"]] extends [undefined]
	? DbDefault
	: Extract<R["toSchema"], string>

type ValidateFkRefsUnion<
	Db extends SqlDatabaseLike,
	Create extends CreateTableStatement,
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
			? SqlParserError<`Unknown referenced table "${R["toTable"]}" in schema`>
			: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
		: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
	: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>

type ValidateFkTargetColumns<Row, Pairs extends ForeignRefMeta["columnPairs"]> =
	NonTrue<ValidateFkReferencedColumnPairs<Pairs, Extract<keyof Row, string>>>

type ValidateOneCreateTableFkRef<
	Db extends SqlDatabaseLike,
	Create extends CreateTableStatement,
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
				: SqlParserError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParserError<"Internal FK target schema resolution error">

/** FK validation for `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` on an existing typed row. */
export type ValidateAlterTableFkRef<
	Db extends SqlDatabaseLike,
	Schema extends string,
	Table extends string,
	Row extends Record<string, unknown>,
	R extends ForeignRefMeta,
> =
	ResolveFkTargetSchema<R, Db["defaultSchema"]> extends infer TargetSchema extends string
		? IsSelfRef<Schema, Table, TargetSchema, R> extends true
			? ValidateFkTargetColumns<Row, R["columnPairs"]>
			: TargetSchema extends keyof Db["schemas"]
				? R["toTable"] extends keyof Db["schemas"][TargetSchema]
					? ValidateFkTargetColumns<Db["schemas"][TargetSchema][R["toTable"]], R["columnPairs"]>
					: UnknownRefTableError<R, TargetSchema, Schema>
				: SqlParserError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParserError<"Internal FK target schema resolution error">
