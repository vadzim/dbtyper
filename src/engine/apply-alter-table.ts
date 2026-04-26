import type { AlterTableStatement } from "../parser/parse-alter-table.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type {
	JsqlFkColumnPair,
	JsqlForeignKeyRef,
	JsqlConstraintEntry,
	JsqlDatabaseShape,
	JsqlSchemaShape,
} from "./jsql-shapes.ts"
import type { ResolveQualifiedIdentifier, TableExists } from "./helpers/engine-helpers.ts"
import type { ValidateAlterTableFkRef } from "./helpers/validate-fk-refs.ts"
import type {
	JsqlAddConstraint,
	JsqlAddColumnFacts,
	JsqlDropColumnFacts,
	JsqlDropConstraint,
	JsqlRenameColumnFacts,
} from "./table-constraint-meta.ts"

export type ApplyAlterTable<Db extends JsqlDatabaseShape, Alter extends AlterTableStatement> =
	ResolveQualifiedIdentifier<Alter["target"], Db["defaultSchema"]> extends [
		infer Schema extends string,
		infer Table extends string,
	]
		? Db["schemas"] extends Record<string, JsqlSchemaShape>
			? TableExists<Db["schemas"], Schema, Table> extends true
				? ApplyAlterOnExistingTable<
						Db,
						Extract<Db["schemas"], Record<string, JsqlSchemaShape>>,
						Schema,
						Table,
						Alter["action"]
					>
				: Alter["ifExists"] extends true
					? Db
					: SqlParserError<`Unknown altered table "${Schema}.${Table}" in database`>
			: SqlParserError<"Internal SqlApplyAlterTable schema shape error">
		: SqlParserError<"Internal SqlApplyAlterTable target error">

type DataColumns<Table> = Table extends { columns: infer C extends Record<string, unknown> } ? C : never

type ConstraintEntryFor<C extends { kind: "primary_key" | "unique"; columns: string[] }> =
	C["kind"] extends "primary_key"
		? { kind: "primary_key"; columns: C["columns"] }
		: { kind: "unique"; columns: C["columns"] }

type ReattachTableMetadata<Table, Data extends Record<string, unknown>> = {
	columns: Data
} & (Table extends { constraints: infer M } ? { constraints: M } : unknown) &
	(Table extends { column_facts: infer F } ? { column_facts: F } : unknown)

type ValidateConstraintColumnsExist<Row extends Record<string, unknown>, Cols extends string[]> = Cols extends [
	infer H extends string,
	...infer R extends string[],
]
	? H extends keyof Row
		? ValidateConstraintColumnsExist<Row, R>
		: SqlParserError<`Unknown column "${H}" in ALTER TABLE constraint`>
	: Cols extends []
		? never
		: SqlParserError<"Internal ALTER TABLE constraint columns error">

type ApplyAlterOnExistingTable<
	Db extends JsqlDatabaseShape,
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	Table extends string,
	Action,
> =
	ApplyTableAction<
		Db,
		Schemas[Schema]["tables"][Table] & { columns: unknown },
		Action,
		Schemas[Schema]["tables"],
		Schema,
		Table
	> extends infer Next
		? Next extends SqlParserError<string>
			? Next
			: Next extends { mode: "row"; row: infer NextTable }
				? {
						defaultSchema: Db["defaultSchema"]
						schemas: UpdateSchemaTableRow<Schemas, Schema, Table, NextTable>
					}
				: Next extends { mode: "schema"; tables: infer NextTables extends Record<string, unknown> }
					? {
							defaultSchema: Db["defaultSchema"]
							schemas: ReplaceSchema<Schemas, Schema, NextTables>
						}
					: SqlParserError<"Internal SqlApplyAlterTable action shape error">
		: SqlParserError<"Internal SqlApplyAlterTable action error">

type ApplyTableAction<
	Db extends JsqlDatabaseShape,
	Tbl extends { columns: unknown },
	Action,
	SchemaTables extends Record<string, unknown>,
	Schema extends string,
	CurrentTable extends string,
> = Action extends {
	kind: "add_column"
	ifNotExists: infer IfNotExists extends boolean
	name: infer Name extends string
	definition: infer Definition
	columnFacts?: infer Facts
}
	? AddColumnToTable<Tbl, Name, Definition, IfNotExists> extends infer Next
		? Next extends SqlParserError<string>
			? Next
			: Name extends keyof DataColumns<Tbl>
				? { mode: "row"; row: Next }
				: Facts extends Record<
							Name,
							infer Entry extends {
								default?: true
								check?: true
								generated?: true | { mode: "stored" | "virtual" }
							}
					  >
					? JsqlAddColumnFacts<Next & { columns: unknown }, Name, Entry> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: WithFacts }
						: SqlParserError<"Internal add_column action error">
					: { mode: "row"; row: Next }
		: SqlParserError<"Internal add_column action error">
	: Action extends {
				kind: "drop_column"
				ifExists: infer IfExists extends boolean
				name: infer Name extends string
		  }
		? DropColumnFromTable<Tbl, Name, IfExists> extends infer Next
			? Next extends SqlParserError<string>
				? Next
				: Name extends keyof DataColumns<Tbl>
					? JsqlDropColumnFacts<Next & { columns: unknown }, Name> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: WithFacts }
						: SqlParserError<"Internal drop_column action error">
					: { mode: "row"; row: Next }
			: SqlParserError<"Internal drop_column action error">
		: Action extends { kind: "rename_column"; from: infer From extends string; to: infer To extends string }
			? RenameColumnInTable<Tbl, From, To> extends infer Next
				? Next extends SqlParserError<string>
					? Next
					: JsqlRenameColumnFacts<Next & { columns: unknown }, From, To> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: WithFacts }
						: SqlParserError<"Internal rename_column action error">
				: SqlParserError<"Internal rename_column action error">
			: Action extends { kind: "rename_to"; name: infer NewName extends string }
				? RenameTableInSchema<SchemaTables, CurrentTable, NewName> extends infer Next
					? Next extends SqlParserError<string>
						? Next
						: { mode: "schema"; tables: Extract<Next, Record<string, unknown>> }
					: SqlParserError<"Internal rename_to action error">
				: Action extends {
							kind: "add_constraint_fk"
							name: infer Cn extends string
							refs: infer R extends JsqlForeignKeyRef
					  }
					? ValidateAlterTableFkRef<Db, Schema, CurrentTable, DataColumns<Tbl>, R> extends infer Err
						? [Err] extends [never]
							? JsqlAddConstraint<Tbl, Cn, { kind: "foreign_key"; refs: R }> extends infer Added
								? Added extends SqlParserError<string>
									? Added
									: { mode: "row"; row: Added }
								: SqlParserError<"Internal ALTER TABLE add_constraint_fk jsql error">
							: Err extends SqlParserError<string>
								? Err
								: SqlParserError<"Internal ALTER TABLE add_constraint_fk validation error">
						: SqlParserError<"Internal ALTER TABLE add_constraint_fk validation error">
					: Action extends {
								kind: "add_constraint_primary"
								name: infer Cn extends string
								columns: infer Cols extends string[]
						  }
						? ValidateConstraintColumnsExist<DataColumns<Tbl>, Cols> extends infer Err2
							? [Err2] extends [never]
								? JsqlAddConstraint<Tbl, Cn, { kind: "primary_key"; columns: Cols }> extends infer Added
									? Added extends SqlParserError<string>
										? Added
										: { mode: "row"; row: Added }
									: SqlParserError<"Internal ALTER TABLE add_constraint_primary jsql error">
								: Err2 extends SqlParserError<string>
									? Err2
									: SqlParserError<"Internal ALTER TABLE add_constraint_primary validation error">
							: SqlParserError<"Internal ALTER TABLE add_constraint_primary validation error">
						: Action extends {
									kind: "add_constraint_unique"
									name: infer Cn extends string
									columns: infer Cols extends string[]
							  }
							? ValidateConstraintColumnsExist<DataColumns<Tbl>, Cols> extends infer Err2
								? [Err2] extends [never]
									? JsqlAddConstraint<Tbl, Cn, { kind: "unique"; columns: Cols }> extends infer Added
										? Added extends SqlParserError<string>
											? Added
											: { mode: "row"; row: Added }
										: SqlParserError<"Internal ALTER TABLE add_constraint_unique jsql error">
									: Err2 extends SqlParserError<string>
										? Err2
										: SqlParserError<"Internal ALTER TABLE add_constraint_unique validation error">
								: SqlParserError<"Internal ALTER TABLE add_constraint_unique validation error">
							: Action extends {
										kind: "drop_constraint"
										ifExists: infer IfE extends boolean
										name: infer Cn extends string
								  }
								? JsqlDropConstraint<Tbl, Cn, IfE> extends infer Dropped
									? Dropped extends SqlParserError<string>
										? Dropped
										: { mode: "row"; row: Dropped }
									: SqlParserError<"Internal ALTER TABLE drop_constraint error">
								: Action extends { kind: "alter_column_set_not_null"; name: infer C extends string }
									? ApplyAlterSetNotNull<Tbl, C> extends infer N
										? N extends SqlParserError<string>
											? N
											: { mode: "row"; row: N }
										: SqlParserError<"Internal alter_column_set_not_null error">
									: Action extends {
												kind: "alter_column_drop_not_null"
												name: infer C extends string
										  }
										? ApplyAlterDropNotNull<Tbl, C> extends infer N2
											? N2 extends SqlParserError<string>
												? N2
												: { mode: "row"; row: N2 }
											: SqlParserError<"Internal alter_column_drop_not_null error">
										: SqlParserError<"Unsupported ALTER TABLE action">

type ApplyAlterSetNotNull<Table, Col extends string> = Col extends keyof DataColumns<Table>
	? DataColumns<Table> extends infer D extends Record<string, unknown>
		? null extends D[Col & keyof D]
			? {
					[K in keyof D]: K extends Col ? Exclude<D[K], null> : D[K]
				} extends infer Out extends Record<string, unknown>
				? ReattachTableMetadata<Table, Out>
				: never
			: Table
		: never
	: SqlParserError<`Unknown column "${Col & string}" in altered table`>

type ApplyAlterDropNotNull<Table, Col extends string> = Col extends keyof DataColumns<Table>
	? DataColumns<Table> extends infer D extends Record<string, unknown>
		? null extends D[Col & keyof D]
			? Table
			: {
						[K in keyof D]: K extends Col ? D[Col] | null : D[K]
				  } extends infer Out extends Record<string, unknown>
				? ReattachTableMetadata<Table, Out>
				: never
		: never
	: SqlParserError<`Unknown column "${Col & string}" in altered table`>

type AddColumnToTable<
	Table,
	Name extends string,
	Definition,
	IfNotExists extends boolean,
> = Name extends keyof DataColumns<Table>
	? IfNotExists extends true
		? Table
		: SqlParserError<`Duplicate column name: ${Name}`>
	: ReattachTableMetadata<Table, DataColumns<Table> & { [K in Name]: Definition }>

type DropColumnFromTable<Table, Name extends string, IfExists extends boolean> = Name extends keyof DataColumns<Table>
	? ReattachTableMetadata<Table, Omit<DataColumns<Table>, Name>>
	: IfExists extends true
		? Table
		: SqlParserError<`Unknown column "${Name}" in altered table`>

type RenameStringList<Col extends string[], From extends string, To extends string> = Col extends [
	infer A extends string,
	...infer R extends string[],
]
	? A extends From
		? [To, ...RenameStringList<R, From, To>]
		: [A, ...RenameStringList<R, From, To>]
	: Col

type RenamePairs<P extends JsqlFkColumnPair[], From extends string, To extends string> = P extends [
	[infer L extends string, infer Rc],
	...infer Rest extends JsqlFkColumnPair[],
]
	? L extends From
		? [[To, Rc], ...RenamePairs<Rest, From, To>]
		: [[L, Rc], ...RenamePairs<Rest, From, To>]
	: P extends []
		? []
		: P

type RenameJsqlMap<M extends { [K: string]: JsqlConstraintEntry }, From extends string, To extends string> = {
	[Kn in keyof M]: M[Kn] extends { kind: "primary_key" | "unique"; columns: infer C extends string[] }
		? { kind: M[Kn]["kind"]; columns: RenameStringList<C, From, To> }
		: M[Kn] extends { kind: "foreign_key"; refs: infer R extends JsqlForeignKeyRef }
			? {
					kind: "foreign_key"
					refs: {
						from: R["from"] extends From ? To : R["from"]
						columnPairs: RenamePairs<R["columnPairs"], From, To>
						toSchema: R["toSchema"]
						toTable: R["toTable"]
					}
				}
			: M[Kn]
}

type RenameColumnInTable<Table, From extends string, To extends string> = From extends keyof DataColumns<Table>
	? To extends keyof Omit<DataColumns<Table>, From>
		? SqlParserError<`Duplicate column name: ${To}`>
		: DataColumns<Table> extends infer D extends Record<string, unknown>
			? Omit<D, From> & { [K in To]: D[From] } extends infer Renamed extends Record<string, unknown>
				? Table extends { constraints: infer Js extends { [K: string]: JsqlConstraintEntry } }
					? {
							columns: Renamed
							constraints: RenameJsqlMap<Js, From, To>
						} & (Table extends { column_facts: infer F } ? { column_facts: F } : unknown)
					: {
							columns: Renamed
						} & (Table extends { column_facts: infer F } ? { column_facts: F } : unknown)
				: never
			: never
	: SqlParserError<`Unknown column "${From}" in altered table`>

type RenameTableInSchema<
	SchemaTables extends Record<string, unknown>,
	CurrentTable extends string,
	NewName extends string,
> = NewName extends keyof SchemaTables
	? SqlParserError<`Duplicate table name: ${NewName}`>
	: CurrentTable extends keyof SchemaTables
		? Omit<SchemaTables, CurrentTable> & {
				[K in NewName]: SchemaTables[CurrentTable]
			}
		: SqlParserError<`Unknown altered table "${CurrentTable}" in database`>

type UpdateSchemaTableRow<
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	Table extends string,
	NextTable,
> = Omit<Schemas, Schema> & {
	[K in Schema]: Omit<Schemas[K], "tables"> & {
		tables: Omit<Schemas[K]["tables"], Table> & {
			[T in Table]: NextTable
		}
	}
}

type ReplaceSchema<
	Schemas extends Record<string, JsqlSchemaShape>,
	Schema extends string,
	NextSchemaTables extends Record<string, unknown>,
> = {
	[K in keyof Schemas]: K extends Schema ? { tables: NextSchemaTables } : Schemas[K]
}
