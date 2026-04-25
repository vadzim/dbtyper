import type { AlterTableStatement } from "../parser/parse-alter-table.ts"
import type { ForeignRefMeta, FkColumnPair } from "../parser/sql-constraints-fk.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { SqlDatabaseLike } from "./sql-database.ts"
import type { ResolveQualifiedIdentifier, TableExists } from "./helpers/engine-helpers.ts"
import type { ValidateAlterTableFkRef } from "./helpers/validate-fk-refs.ts"
import type {
	JsqlAddConstraint,
	JsqlAddColumnFacts,
	JsqlConstraintEntry,
	JsqlDropColumnFacts,
	JsqlDropConstraint,
	JsqlRenameColumnFacts,
	JsqlTableColumnFactsKey,
	JsqlTableConstraintsKey,
} from "./table-constraint-meta.ts"

export type ApplyAlterTable<Db extends SqlDatabaseLike, Alter extends AlterTableStatement> =
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
					: SqlParserError<`Unknown altered table "${Schema}.${Table}" in database`>
			: SqlParserError<"Internal SqlApplyAlterTable schema shape error">
		: SqlParserError<"Internal SqlApplyAlterTable target error">

type TableRow<Row> = Extract<Row, Record<string, unknown>>
type DataColumns<Row> = Omit<TableRow<Row>, JsqlTableConstraintsKey | JsqlTableColumnFactsKey>

type ConstraintEntryFor<C extends { kind: "primary_key" | "unique"; columns: string[] }> =
	C["kind"] extends "primary_key"
		? { kind: "primary_key"; columns: C["columns"] }
		: { kind: "unique"; columns: C["columns"] }

type ReattachMetadata<Row, Data extends Record<string, unknown>> = (JsqlTableConstraintsKey extends keyof TableRow<Row>
	? { [K in JsqlTableConstraintsKey]: TableRow<Row>[JsqlTableConstraintsKey] }
	: {}) &
	(JsqlTableColumnFactsKey extends keyof TableRow<Row>
		? { [K in JsqlTableColumnFactsKey]: TableRow<Row>[JsqlTableColumnFactsKey] }
		: {}) &
	Data

type RowWithConstraints<
	Row,
	Constraints extends { name: string; kind: "primary_key" | "unique"; columns: string[] }[],
> = Constraints extends [
	infer H extends { name: string; kind: "primary_key" | "unique"; columns: string[] },
	...infer R extends { name: string; kind: "primary_key" | "unique"; columns: string[] }[],
]
	? JsqlAddConstraint<Row, H["name"], ConstraintEntryFor<H>> extends infer Added
		? Added extends SqlParserError<string>
			? Added
			: RowWithConstraints<Added, R>
		: SqlParserError<"Internal ALTER TABLE add_constraint_fk jsql error">
	: Row

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
	Db extends SqlDatabaseLike,
	Schemas extends Record<string, Record<string, unknown>>,
	Schema extends string,
	Table extends string,
	Action,
> =
	ApplyTableAction<Db, Schemas[Schema][Table], Action, Schemas[Schema], Schema, Table> extends infer Next
		? Next extends SqlParserError<string>
			? Next
			: Next extends { mode: "row"; row: infer NextRow extends Record<string, unknown> }
				? {
						kind: "database"
						defaultSchema: Db["defaultSchema"]
						schemas: UpdateSchemaTableRow<Schemas, Schema, Table, NextRow>
					}
				: Next extends { mode: "schema"; tables: infer NextTables extends Record<string, unknown> }
					? {
							kind: "database"
							defaultSchema: Db["defaultSchema"]
							schemas: ReplaceSchema<Schemas, Schema, NextTables>
						}
					: SqlParserError<"Internal SqlApplyAlterTable action shape error">
		: SqlParserError<"Internal SqlApplyAlterTable action error">

type ApplyTableAction<
	Db extends SqlDatabaseLike,
	Row,
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
	? AddColumnToRow<Row, Name, Definition, IfNotExists> extends infer Next
		? Next extends SqlParserError<string>
			? Next
			: Name extends keyof DataColumns<Row>
				? { mode: "row"; row: Extract<Next, Record<string, unknown>> }
				: Facts extends Record<
							Name,
							infer Entry extends {
								default?: true
								check?: true
								generated?: true | { mode: "stored" | "virtual" }
							}
					  >
					? JsqlAddColumnFacts<Extract<Next, Record<string, unknown>>, Name, Entry> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: Extract<WithFacts, Record<string, unknown>> }
						: SqlParserError<"Internal add_column action error">
					: { mode: "row"; row: Extract<Next, Record<string, unknown>> }
		: SqlParserError<"Internal add_column action error">
	: Action extends {
				kind: "drop_column"
				ifExists: infer IfExists extends boolean
				name: infer Name extends string
		  }
		? DropColumnFromRow<Row, Name, IfExists> extends infer Next
			? Next extends SqlParserError<string>
				? Next
				: Name extends keyof DataColumns<Row>
					? JsqlDropColumnFacts<Extract<Next, Record<string, unknown>>, Name> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: Extract<WithFacts, Record<string, unknown>> }
						: SqlParserError<"Internal drop_column action error">
					: { mode: "row"; row: Extract<Next, Record<string, unknown>> }
			: SqlParserError<"Internal drop_column action error">
		: Action extends { kind: "rename_column"; from: infer From extends string; to: infer To extends string }
			? RenameColumnInRow<Row, From, To> extends infer Next
				? Next extends SqlParserError<string>
					? Next
					: JsqlRenameColumnFacts<Extract<Next, Record<string, unknown>>, From, To> extends infer WithFacts
						? WithFacts extends SqlParserError<string>
							? WithFacts
							: { mode: "row"; row: Extract<WithFacts, Record<string, unknown>> }
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
							refs: infer R extends ForeignRefMeta
					  }
					? ValidateAlterTableFkRef<Db, Schema, CurrentTable, DataColumns<Row>, R> extends infer Err
						? [Err] extends [never]
							? JsqlAddConstraint<TableRow<Row>, Cn, { kind: "foreign_key"; refs: R }> extends infer Added
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
						? ValidateConstraintColumnsExist<DataColumns<Row>, Cols> extends infer Err2
							? [Err2] extends [never]
								? JsqlAddConstraint<
										TableRow<Row>,
										Cn,
										{ kind: "primary_key"; columns: Cols }
									> extends infer Added
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
							? ValidateConstraintColumnsExist<DataColumns<Row>, Cols> extends infer Err2
								? [Err2] extends [never]
									? JsqlAddConstraint<
											TableRow<Row>,
											Cn,
											{ kind: "unique"; columns: Cols }
										> extends infer Added
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
								? JsqlDropConstraint<TableRow<Row>, Cn, IfE> extends infer Dropped
									? Dropped extends SqlParserError<string>
										? Dropped
										: { mode: "row"; row: Dropped }
									: SqlParserError<"Internal ALTER TABLE drop_constraint error">
								: Action extends { kind: "alter_column_set_not_null"; name: infer C extends string }
									? ApplyAlterSetNotNull<TableRow<Row>, C> extends infer N
										? N extends SqlParserError<string>
											? N
											: { mode: "row"; row: Extract<N, Record<string, unknown>> }
										: SqlParserError<"Internal alter_column_set_not_null error">
									: Action extends {
												kind: "alter_column_drop_not_null"
												name: infer C extends string
										  }
										? ApplyAlterDropNotNull<TableRow<Row>, C> extends infer N2
											? N2 extends SqlParserError<string>
												? N2
												: { mode: "row"; row: Extract<N2, Record<string, unknown>> }
											: SqlParserError<"Internal alter_column_drop_not_null error">
										: SqlParserError<"Unsupported ALTER TABLE action">

type ApplyAlterSetNotNull<Row extends Record<string, unknown>, Col extends string> = Col extends
	| JsqlTableConstraintsKey
	| JsqlTableColumnFactsKey
	? SqlParserError<`Unknown column "${Col & string}" in altered table`>
	: Col extends keyof DataColumns<Row>
		? null extends TableRow<Row>[Col]
			? {
					[K in keyof DataColumns<Row>]: K extends Col ? Exclude<TableRow<Row>[K], null> : TableRow<Row>[K]
				} extends infer Out extends Record<string, unknown>
				? ReattachMetadata<Row, Out>
				: never
			: TableRow<Row>
		: SqlParserError<`Unknown column "${Col & string}" in altered table`>

type ApplyAlterDropNotNull<Row extends Record<string, unknown>, Col extends string> = Col extends
	| JsqlTableConstraintsKey
	| JsqlTableColumnFactsKey
	? SqlParserError<`Unknown column "${Col & string}" in altered table`>
	: Col extends keyof DataColumns<Row>
		? null extends TableRow<Row>[Col]
			? TableRow<Row>
			: {
						[K in keyof DataColumns<Row>]: K extends Col ? TableRow<Row>[K] | null : TableRow<Row>[K]
				  } extends infer Out extends Record<string, unknown>
				? ReattachMetadata<Row, Out>
				: never
		: SqlParserError<`Unknown column "${Col & string}" in altered table`>

type AddColumnToRow<Row, Name extends string, Definition, IfNotExists extends boolean> = Name extends
	| JsqlTableConstraintsKey
	| JsqlTableColumnFactsKey
	? SqlParserError<`Invalid column name: ${Name & string}`>
	: Name extends keyof DataColumns<Row>
		? IfNotExists extends true
			? Row
			: SqlParserError<`Duplicate column name: ${Name}`>
		: ReattachMetadata<Row, DataColumns<Row> & { [K in Name]: Definition }>

type DropColumnFromRow<Row, Name extends string, IfExists extends boolean> = Name extends
	| JsqlTableConstraintsKey
	| JsqlTableColumnFactsKey
	? IfExists extends true
		? Row
		: SqlParserError<`Unknown column "${Name}" in altered table`>
	: Name extends keyof DataColumns<Row>
		? ReattachMetadata<Row, Omit<DataColumns<Row>, Name>>
		: IfExists extends true
			? Row
			: SqlParserError<`Unknown column "${Name}" in altered table`>

type RenameStringList<Col extends string[], From extends string, To extends string> = Col extends [
	infer A extends string,
	...infer R extends string[],
]
	? A extends From
		? [To, ...RenameStringList<R, From, To>]
		: [A, ...RenameStringList<R, From, To>]
	: Col

type RenamePairs<P extends FkColumnPair[], From extends string, To extends string> = P extends [
	[infer L extends string, infer Rc],
	...infer Rest extends FkColumnPair[],
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
		: M[Kn] extends { kind: "foreign_key"; refs: infer R extends ForeignRefMeta }
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

type RenameColumnInRow<Row, From extends string, To extends string> = From extends JsqlTableConstraintsKey
	? SqlParserError<`Unknown column "${From}" in altered table`>
	: From extends JsqlTableColumnFactsKey
		? SqlParserError<`Unknown column "${From}" in altered table`>
		: To extends JsqlTableConstraintsKey | JsqlTableColumnFactsKey
			? SqlParserError<`Duplicate column name: ${To}`>
			: From extends keyof DataColumns<Row>
				? To extends keyof Omit<DataColumns<Row>, From>
					? SqlParserError<`Duplicate column name: ${To}`>
					: Omit<DataColumns<Row>, From> & { [K in To]: DataColumns<Row>[From] } extends infer Renamed extends
								Record<string, unknown>
						? JsqlTableConstraintsKey extends keyof TableRow<Row>
							? TableRow<Row>[JsqlTableConstraintsKey] extends infer Js extends {
									[K: string]: JsqlConstraintEntry
								}
								? ReattachMetadata<
										Row,
										Renamed & { [J in JsqlTableConstraintsKey]: RenameJsqlMap<Js, From, To> }
									>
								: ReattachMetadata<Row, Renamed>
							: ReattachMetadata<Row, Renamed>
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
