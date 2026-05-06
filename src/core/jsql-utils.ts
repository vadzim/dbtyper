import type {
	JsqlDatabaseShape,
	JsqlSchemaShape,
	JsqlDataShape,
	JsqlTypeShape,
	JsqlColumnFactsEntry,
} from "./jsql-shapes.ts"
import type { ReplaceProp } from "./type-utils.ts"

export type JsqlCreateDatabase<DefaultSchema extends string> = {
	defaultSchema: DefaultSchema
	schemas: {}
}

export type JsqlCreateSchema = {
	sets: {}
}

export type JsqlCreateTable<
	Columns extends Record<string, string>,
	Facts extends Record<string, unknown> | null = null,
	Constraints extends Record<string, unknown> | null = null,
> = {
	kind: "table"
	columns: Columns
	column_facts: Facts
	constraints: Constraints
}

export type JsqlCreateColumn<SqlType extends string, Nullability extends "not_null" | "nullable" = "nullable"> = {
	type: SqlType
	nullability: Nullability
}

export type JsqlCreateView<Columns extends Record<string, string>> = {
	kind: "view"
	columns: Columns
}

export type JsqlDbGetSchema<Db extends JsqlDatabaseShape, Sch extends string> = Sch extends keyof Db["schemas"]
	? Db["schemas"][Sch & keyof Db["schemas"]] & JsqlSchemaShape
	: null

export type JsqlSchemaGetData<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["sets"]
		? Schema["sets"][Tab & keyof Schema["sets"]]
		: null
	: null

export type JsqlDbGetData<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetData<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

export type JsqlSchemaGetType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["types"]
		? Schema["types"][Tab & keyof Schema["types"]]
		: null
	: null

export type JsqlDbGetType<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetType<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

export type JsqlSchemaGetTable<Schema extends JsqlSchemaShape | null, Tab extends string> =
	JsqlSchemaGetData<Schema, Tab> extends infer T extends JsqlDataShape<"table"> ? T : null

export type JsqlDbGetTable<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetTable<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

export type JsqlSchemaGetView<Schema extends JsqlSchemaShape | null, Tab extends string> =
	JsqlSchemaGetData<Schema, Tab> extends infer T extends JsqlDataShape<"view"> ? T : null

export type JsqlDbGetView<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetView<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

export type JsqlDbReplaceSchema<
	Db extends JsqlDatabaseShape,
	Name extends string,
	Schema extends JsqlSchemaShape | null,
> = (
	Schema extends null
		? ReplaceProp<Db, "schemas", Omit<Db["schemas"], Name>>
		: ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Name, Schema>>
) extends infer R extends JsqlDatabaseShape
	? R
	: never

export type JsqlSchemaReplaceData<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Data extends JsqlDataShape | null,
> = Schema extends JsqlSchemaShape
	? Data extends null
		? ReplaceProp<Schema, "sets", Omit<Schema["sets"], Name>>
		: ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Name, Data>>
	: null

export type JsqlDbReplaceData<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Data extends JsqlDataShape | null,
> = JsqlDbReplaceSchema<Db, Schema, JsqlSchemaReplaceData<JsqlDbGetSchema<Db, Schema>, Name, Data>>

export type JsqlSchemaReplaceType<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Type extends JsqlTypeShape | null,
> = Schema extends JsqlSchemaShape
	? Type extends null
		? ReplaceProp<Schema, "types", Omit<Schema["types"], Name>>
		: ReplaceProp<Schema, "types", ReplaceProp<Schema["types"], Name, Type>>
	: null

export type JsqlDbReplaceType<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Type extends JsqlTypeShape | null,
> = JsqlDbReplaceSchema<Db, Schema, JsqlSchemaReplaceType<JsqlDbGetSchema<Db, Schema>, Name, Type>>

export type JsqlSchemaGetEnum<Schema extends JsqlSchemaShape | null, Name extends string> =
	JsqlSchemaGetType<Schema, Name> extends infer T ? (T extends { kind: "enum"; values: infer V } ? V : null) : null

export type JsqlDbGetEnum<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlSchemaGetEnum<
	JsqlDbGetSchema<Db, Schema>,
	Name
>

export type JsqlSchemaReplaceEnum<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Values extends readonly string[] | null,
> = Values extends null
	? JsqlSchemaReplaceType<Schema, Name, null>
	: Values extends readonly string[]
		? JsqlSchemaReplaceType<Schema, Name, { kind: "enum"; values: Values }>
		: null

export type JsqlDbReplaceEnum<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Values extends readonly string[] | null,
> = JsqlDbReplaceSchema<Db, Schema, JsqlSchemaReplaceEnum<JsqlDbGetSchema<Db, Schema>, Name, Values>>

export type JsqlDataGetColumnType<Data extends JsqlDataShape | null, Col extends string> = Data extends JsqlDataShape
	? Col extends keyof Data["columns"]
		? Data["columns"][Col & keyof Data["columns"]]
		: null
	: null

export type JsqlTableGetColumnFacts<Table extends JsqlDataShape<"table"> | null, Col extends string> =
	Table extends JsqlDataShape<"table">
		? Table["column_facts"] extends infer Facts
			? Facts extends Record<string, unknown>
				? Col extends keyof Facts
					? Facts[Col & keyof Facts]
					: null
				: null
			: null
		: null

export type JsqlTableGetColumnNullability<Table extends JsqlDataShape<"table"> | null, Col extends string> =
	Table extends JsqlDataShape<"table">
		? Table["column_facts"] extends infer Facts
			? Facts extends Record<string, unknown>
				? Col extends keyof Facts
					? Facts[Col & keyof Facts] extends infer F
						? F extends { nullability: infer N }
							? N
							: null
						: null
					: null
				: null
			: null
		: null

export type JsqlTableGetColumnDefault<Table extends JsqlDataShape<"table"> | null, Col extends string> =
	Table extends JsqlDataShape<"table">
		? Table["column_facts"] extends infer Facts
			? Facts extends Record<string, unknown>
				? Col extends keyof Facts
					? Facts[Col & keyof Facts] extends infer F
						? F extends { default: infer D }
							? D
							: null
						: null
					: null
				: null
			: null
		: null

export type JsqlTableAddColumn<
	Table extends JsqlDataShape<"table"> | null,
	Name extends string,
	SqlType extends string,
> = JsqlTableReplaceColumn<Table, Name, JsqlCreateColumn<SqlType>>

export type JsqlTableDropColumn<
	Table extends JsqlDataShape<"table"> | null,
	Name extends string,
> = JsqlTableReplaceColumn<Table, Name, null>

export type JsqlTableRenameColumn<
	Table extends JsqlDataShape<"table"> | null,
	OldName extends string,
	NewName extends string,
> = JsqlTableReplaceColumn<JsqlTableReplaceColumn<Table, OldName, null>, NewName, JsqlTableGetColumn<Table, OldName>>

export type JsqlTableReplaceColumn<
	Table extends JsqlDataShape<"table"> | null,
	Name extends string,
	Column extends (JsqlColumnFactsEntry & { type: string }) | null,
> =
	Table extends JsqlDataShape<"table">
		? Column extends JsqlColumnFactsEntry & { type: string }
			? ReplaceProp<
					ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Name, Column["type"]>>,
					"column_facts",
					ReplaceProp<
						Table["column_facts"] extends Record<string, unknown> ? Table["column_facts"] : {},
						Name,
						Omit<Column, "type">
					>
				>
			: ReplaceProp<
					ReplaceProp<Table, "columns", Omit<Table["columns"], Name>>,
					"column_facts",
					Omit<Table["column_facts"], Name>
				>
		: null

export type JsqlTableReplaceColumnType<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	SqlType extends string,
> =
	Table extends JsqlDataShape<"table">
		? Col extends keyof Table["columns"]
			? ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Col, SqlType>>
			: null
		: null

export type JsqlTableReplaceColumnNullability<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> =
	Table extends JsqlDataShape<"table">
		? Col extends keyof Table["columns"]
			? ReplaceProp<
					Table,
					"column_facts",
					Nullability extends null
						? Table["column_facts"] extends infer Facts
							? Facts extends Record<string, unknown>
								? ReplaceProp<Facts, Col, Omit<Facts[Col & keyof Facts], "nullability">>
								: Facts
							: Table["column_facts"]
						: ReplaceProp<
								Table["column_facts"] extends Record<string, unknown> ? Table["column_facts"] : {},
								Col,
								ReplaceProp<
									Table["column_facts"] extends Record<string, unknown>
										? Col extends keyof Table["column_facts"]
											? Table["column_facts"][Col & keyof Table["column_facts"]]
											: {}
										: {},
									"nullability",
									Nullability
								>
							>
				>
			: null
		: null

export type JsqlTableReplaceColumnDefault<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	HasDefault extends true | null,
> =
	Table extends JsqlDataShape<"table">
		? Col extends keyof Table["columns"]
			? ReplaceProp<
					Table,
					"column_facts",
					HasDefault extends null
						? Table["column_facts"] extends infer Facts
							? Facts extends Record<string, unknown>
								? ReplaceProp<Facts, Col, Omit<Facts[Col & keyof Facts], "default">>
								: Facts
							: Table["column_facts"]
						: ReplaceProp<
								Table["column_facts"] extends Record<string, unknown> ? Table["column_facts"] : {},
								Col,
								ReplaceProp<
									Table["column_facts"] extends Record<string, unknown>
										? Col extends keyof Table["column_facts"]
											? Table["column_facts"][Col & keyof Table["column_facts"]]
											: {}
										: {},
									"default",
									HasDefault
								>
							>
				>
			: null
		: null

export type JsqlSchemaGetColumnType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
> = JsqlDataGetColumnType<JsqlSchemaGetTable<Schema, Tab>, Name>

export type JsqlSchemaGetColumnFacts<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
> = JsqlTableGetColumnFacts<JsqlSchemaGetTable<Schema, Tab>, Name>

export type JsqlTableGetColumn<Table extends JsqlDataShape<"table"> | null, Name extends string> =
	JsqlDataGetColumnType<Table, Name> extends infer Type extends string
		? { type: Type } & (JsqlTableGetColumnFacts<Table, Name> extends infer Facts extends {} ? Facts : {})
		: null

export type JsqlSchemaGetColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
> = JsqlTableGetColumn<JsqlSchemaGetTable<Schema, Tab>, Name>

export type JsqlSchemaGetColumnNullability<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlTableGetColumnNullability<JsqlSchemaGetTable<Schema, Tab>, Col>

export type JsqlSchemaGetColumnDefault<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlTableGetColumnDefault<JsqlSchemaGetTable<Schema, Tab>, Col>

export type JsqlSchemaAddColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
	SqlType extends string,
> = Schema extends JsqlSchemaShape
	? JsqlTableAddColumn<JsqlSchemaGetTable<Schema, Tab>, Name, SqlType> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaDropColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
> = Schema extends JsqlSchemaShape
	? JsqlTableDropColumn<JsqlSchemaGetTable<Schema, Tab>, Name> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaRenameColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	OldName extends string,
	NewName extends string,
> = Schema extends JsqlSchemaShape
	? JsqlTableRenameColumn<JsqlSchemaGetTable<Schema, Tab>, OldName, NewName> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Name extends string,
	Column extends (JsqlColumnFactsEntry & { type: string }) | null,
> = Schema extends JsqlSchemaShape
	? JsqlTableReplaceColumn<JsqlSchemaGetTable<Schema, Tab>, Name, Column> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumnType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	SqlType extends string,
> = Schema extends JsqlSchemaShape
	? JsqlTableReplaceColumnType<JsqlSchemaGetTable<Schema, Tab>, Col, SqlType> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumnNullability<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> = JsqlSchemaReplaceData<
	Schema,
	Tab,
	JsqlTableReplaceColumnNullability<JsqlSchemaGetTable<Schema, Tab>, Col, Nullability>
>

export type JsqlSchemaReplaceColumnDefault<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	HasDefault extends true | null,
> = Schema extends JsqlSchemaShape
	? JsqlTableReplaceColumnDefault<JsqlSchemaGetTable<Schema, Tab>, Col, HasDefault> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlDbGetColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlSchemaGetColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name>

export type JsqlDbGetColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlSchemaGetColumnType<JsqlDbGetSchema<Db, Sch>, Tab, Name>

export type JsqlDbGetColumnFacts<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlSchemaGetColumnFacts<JsqlDbGetSchema<Db, Sch>, Tab, Name>

export type JsqlDbGetColumnNullability<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlSchemaGetColumnNullability<JsqlDbGetSchema<Db, Sch>, Tab, Name>

export type JsqlDbGetColumnDefault<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlSchemaGetColumnDefault<JsqlDbGetSchema<Db, Sch>, Tab, Name>

export type JsqlDbAddColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	SqlType extends string,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaAddColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name, SqlType>>

export type JsqlDbDropColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaDropColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name>>

export type JsqlDbRenameColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	OldName extends string,
	NewName extends string,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaRenameColumn<JsqlDbGetSchema<Db, Sch>, Tab, OldName, NewName>>

export type JsqlDbReplaceColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	Column extends (JsqlColumnFactsEntry & { type: string }) | null,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name, Column>>

export type JsqlDbReplaceColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	SqlType extends string,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumnType<JsqlDbGetSchema<Db, Sch>, Tab, Name, SqlType>>

export type JsqlDbReplaceColumnNullability<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	Nullability extends "not_null" | "nullable" | null,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumnNullability<JsqlDbGetSchema<Db, Sch>, Tab, Name, Nullability>>

export type JsqlDbReplaceColumnDefault<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	HasDefault extends true | null,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumnDefault<JsqlDbGetSchema<Db, Sch>, Tab, Name, HasDefault>>
