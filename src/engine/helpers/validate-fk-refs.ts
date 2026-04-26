import type { CreateTableStatement } from "../../parser/parse-create-table.ts"
import type {
	IntraTableConstraintRef,
	ValidateColumnTupleRefs,
	ValidateFkLocalColumnPairs,
	ValidateFkReferencedColumnPairs,
} from "../../parser/sql-constraints-fk.ts"
import type { SqlParserError } from "../../../core/sql-tokens.ts"
import type { JsqlForeignKeyRef, JsqlDatabaseShape } from "../jsql-shapes.ts"

type NonTrue<Value> = Value extends true ? never : Value

type ValidateIntraConstraintsOnRow<Row, Intra extends IntraTableConstraintRef[]> = Intra extends [
	infer Head extends IntraTableConstraintRef,
	...infer Tail extends IntraTableConstraintRef[],
]
	? Head extends { columns: infer Cols extends string[] }
		? ValidateColumnTupleRefs<Cols, Extract<keyof Row, string>> extends infer V
			? V extends true
				? ValidateIntraConstraintsOnRow<Row, Tail>
				: V
			: never
		: never
	: never

type ValidateFkLocalsOnRow<Row, Refs> = [Refs] extends [undefined | never]
	? never
	: Refs extends JsqlForeignKeyRef
		? NonTrue<ValidateFkLocalColumnPairs<Refs["columnPairs"], Extract<keyof Row, string>>>
		: never

/** PRIMARY KEY / UNIQUE / FOREIGN KEY local columns vs the new table row (apply-time). */
export type ValidateCreateTableLocalRefs<Row, Intra extends IntraTableConstraintRef[], Refs> =
	ValidateIntraConstraintsOnRow<Row, Intra> extends infer E1
		? [E1] extends [never]
			? ValidateFkLocalsOnRow<Row, Refs>
			: E1
		: ValidateFkLocalsOnRow<Row, Refs>

export type ValidateCreateTableFkRefs<
	Db extends JsqlDatabaseShape,
	Create extends CreateTableStatement,
	NewSchema extends string,
	NewTable extends string,
> = Create["refs"] extends undefined ? never : ValidateFkRefsUnion<Db, Create, NewSchema, NewTable, Create["refs"]>

type ResolveFkTargetSchema<R extends JsqlForeignKeyRef, DbDefault extends string> = [R["toSchema"]] extends [undefined]
	? DbDefault
	: Extract<R["toSchema"], string>

type ValidateFkRefsUnion<
	Db extends JsqlDatabaseShape,
	Create extends CreateTableStatement,
	NewSchema extends string,
	NewTable extends string,
	Refs,
> = Refs extends JsqlForeignKeyRef ? ValidateOneCreateTableFkRef<Db, Create, NewSchema, NewTable, Refs> : never

type IsSelfRef<
	NewSchema extends string,
	NewTable extends string,
	TargetSchema extends string,
	R extends JsqlForeignKeyRef,
> = TargetSchema extends NewSchema
	? NewSchema extends TargetSchema
		? R["toTable"] extends NewTable
			? NewTable extends R["toTable"]
				? true
				: false
			: false
		: false
	: false

type UnknownRefTableError<R extends JsqlForeignKeyRef, TargetSchema extends string, NewSchema extends string> = [
	R["toSchema"],
] extends [undefined]
	? TargetSchema extends NewSchema
		? NewSchema extends TargetSchema
			? SqlParserError<`Unknown referenced table "${R["toTable"]}" in schema`>
			: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
		: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>
	: SqlParserError<`Unknown referenced table "${TargetSchema}.${R["toTable"]}" in database`>

type ValidateFkTargetColumns<Row, Pairs extends JsqlForeignKeyRef["columnPairs"]> = NonTrue<
	ValidateFkReferencedColumnPairs<Pairs, Extract<keyof Row, string>>
>

type ValidateOneCreateTableFkRef<
	Db extends JsqlDatabaseShape,
	Create extends CreateTableStatement,
	NewSchema extends string,
	NewTable extends string,
	R extends JsqlForeignKeyRef,
> =
	ResolveFkTargetSchema<R, Db["defaultSchema"]> extends infer TargetSchema extends string
		? IsSelfRef<NewSchema, NewTable, TargetSchema, R> extends true
			? ValidateFkTargetColumns<Create["row"], R["columnPairs"]>
			: TargetSchema extends keyof Db["schemas"]
				? R["toTable"] extends keyof Db["schemas"][TargetSchema]["tables"]
					? ValidateFkTargetColumns<
							Db["schemas"][TargetSchema]["tables"][R["toTable"]]["columns"],
							R["columnPairs"]
						>
					: UnknownRefTableError<R, TargetSchema, NewSchema>
				: SqlParserError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParserError<"Internal FK target schema resolution error">

/** FK validation for `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` on an existing typed row. */
export type ValidateAlterTableFkRef<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Row extends Record<string, unknown>,
	R extends JsqlForeignKeyRef,
> =
	ResolveFkTargetSchema<R, Db["defaultSchema"]> extends infer TargetSchema extends string
		? IsSelfRef<Schema, Table, TargetSchema, R> extends true
			? ValidateFkTargetColumns<Row, R["columnPairs"]>
			: TargetSchema extends keyof Db["schemas"]
				? R["toTable"] extends keyof Db["schemas"][TargetSchema]["tables"]
					? ValidateFkTargetColumns<
							Db["schemas"][TargetSchema]["tables"][R["toTable"]]["columns"],
							R["columnPairs"]
						>
					: UnknownRefTableError<R, TargetSchema, Schema>
				: SqlParserError<`Unknown referenced schema "${TargetSchema}" in database`>
		: SqlParserError<"Internal FK target schema resolution error">
