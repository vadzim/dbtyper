import type { SqlAlterTableLike } from "../parser/sql-alter-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike } from "./sql-database.js"
import type { ResolveQualifiedIdentifier, TableExists } from "./sql-engine.js"

export type SqlApplyAlterTable<Db extends SqlDatabaseLike, Alter extends SqlAlterTableLike> =
	ResolveQualifiedIdentifier<Alter["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, Record<string, unknown>>
			? TableExists<Db["schemas"], Schema, Table> extends true
				? ApplyAlterOnExistingTable<
						Db,
						Extract<Db["schemas"], Record<string, Record<string, unknown>>>,
						Schema,
						Table,
						Alter["action"]
					>
				: Alter["ifExists"] extends true
					? Db
					: SqlParseError<`Unknown altered table "${Schema}.${Table}" in database`>
			: SqlParseError<"Internal SqlApplyAlterTable schema shape error">
		: SqlParseError<"Internal SqlApplyAlterTable target error">

type ApplyAlterOnExistingTable<
	Db extends SqlDatabaseLike,
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
	Action,
> =
	ApplyTableAction<Schemas[Schema][Table], Action, Schemas[Schema], Table> extends infer Next
		? Next extends SqlParseError<string>
			? Next
			: Next extends { mode: "row"; row: infer NextRow extends Record<string, unknown> }
				? {
						readonly kind: "database"
						readonly defaultSchema: Db["defaultSchema"]
						readonly schemas: UpdateSchemaTableRow<Schemas, Schema, Table, NextRow>
					}
				: Next extends { mode: "schema"; tables: infer NextTables extends Record<string, unknown> }
					? {
							readonly kind: "database"
							readonly defaultSchema: Db["defaultSchema"]
							readonly schemas: ReplaceSchema<Schemas, Schema, NextTables>
						}
					: SqlParseError<"Internal SqlApplyAlterTable action shape error">
		: SqlParseError<"Internal SqlApplyAlterTable action error">

type ApplyTableAction<
	Row,
	Action,
	SchemaTables extends Record<string, unknown>,
	CurrentTable extends string = never,
> = Action extends {
	kind: "add_column"
	ifNotExists: infer IfNotExists extends boolean
	name: infer Name extends string
	definition: infer Definition
}
	? AddColumnToRow<Row, Name, Definition, IfNotExists> extends infer Next
		? Next extends SqlParseError<string>
			? Next
			: { mode: "row"; row: Extract<Next, Record<string, unknown>> }
		: SqlParseError<"Internal add_column action error">
	: Action extends {
				kind: "drop_column"
				ifExists: infer IfExists extends boolean
				name: infer Name extends string
		  }
		? DropColumnFromRow<Row, Name, IfExists> extends infer Next
			? Next extends SqlParseError<string>
				? Next
				: { mode: "row"; row: Extract<Next, Record<string, unknown>> }
			: SqlParseError<"Internal drop_column action error">
		: Action extends { kind: "rename_column"; from: infer From extends string; to: infer To extends string }
			? RenameColumnInRow<Row, From, To> extends infer Next
				? Next extends SqlParseError<string>
					? Next
					: { mode: "row"; row: Extract<Next, Record<string, unknown>> }
				: SqlParseError<"Internal rename_column action error">
			: Action extends { kind: "rename_to"; name: infer NewName extends string }
				? RenameTableInSchema<SchemaTables, CurrentTable, NewName> extends infer Next
					? Next extends SqlParseError<string>
						? Next
						: { mode: "schema"; tables: Extract<Next, Record<string, unknown>> }
					: SqlParseError<"Internal rename_to action error">
				: SqlParseError<"Unsupported ALTER TABLE action">

type AddColumnToRow<Row, Name extends string, Definition, IfNotExists extends boolean> = Name extends keyof Extract<
	Row,
	Record<string, unknown>
>
	? IfNotExists extends true
		? Row
		: SqlParseError<`Duplicate column name: ${Name}`>
	: Extract<Row, Record<string, unknown>> & { [K in Name]: Definition }

type DropColumnFromRow<Row, Name extends string, IfExists extends boolean> = Name extends keyof Extract<
	Row,
	Record<string, unknown>
>
	? Omit<Extract<Row, Record<string, unknown>>, Name>
	: IfExists extends true
		? Row
		: SqlParseError<`Unknown column "${Name}" in altered table`>

type RenameColumnInRow<Row, From extends string, To extends string> = From extends keyof Extract<
	Row,
	Record<string, unknown>
>
	? To extends keyof Extract<Row, Record<string, unknown>>
		? SqlParseError<`Duplicate column name: ${To}`>
		: Omit<Extract<Row, Record<string, unknown>>, From> & {
				[K in To]: Extract<Row, Record<string, unknown>>[From]
			}
	: SqlParseError<`Unknown column "${From}" in altered table`>

type RenameTableInSchema<
	SchemaTables extends Record<string, unknown>,
	CurrentTable extends string,
	NewName extends string,
> = NewName extends keyof SchemaTables
	? SqlParseError<`Duplicate table name: ${NewName}`>
	: CurrentTable extends keyof SchemaTables
		? Omit<SchemaTables, CurrentTable> & {
				[K in NewName]: SchemaTables[CurrentTable]
			}
		: SqlParseError<`Unknown altered table "${CurrentTable}" in database`>

type UpdateSchemaTableRow<
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
	NextRow extends Record<string, unknown>,
> = Omit<Schemas, Schema> & {
	[K in Schema]: Omit<Extract<Schemas[K], Record<string, unknown>>, Table> & {
		[T in Table]: NextRow
	}
}

type ReplaceSchema<
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	NextSchemaTables extends Record<string, unknown>,
> = {
	[K in keyof Schemas]: K extends Schema ? NextSchemaTables : Schemas[K]
}
