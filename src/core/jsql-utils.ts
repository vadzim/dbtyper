import type {
	JsqlDatabaseShape,
	JsqlSchemaShape,
	JsqlDataShape,
	JsqlTypeShape,
	JsqlConstraintEntry,
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

export type JsqlCreateView<Columns extends Record<string, string>> = {
	kind: "view"
	columns: Columns
}

export type JsqlDbGetSchema<Db extends JsqlDatabaseShape, Sch extends string> = Sch extends keyof Db["schemas"]
	? Db["schemas"][Sch & keyof Db["schemas"]] & JsqlSchemaShape
	: null

export type JsqlSchemaGetSet<Schema extends JsqlSchemaShape | null, Tab extends string> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["sets"]
		? Schema["sets"][Tab & keyof Schema["sets"]]
		: null
	: null

export type JsqlDbGetSet<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetSet<
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
	JsqlSchemaGetSet<Schema, Tab> extends infer T extends JsqlDataShape<"table"> ? T : null

export type JsqlDbGetTable<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetTable<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

export type JsqlSchemaGetView<Schema extends JsqlSchemaShape | null, Tab extends string> =
	JsqlSchemaGetSet<Schema, Tab> extends infer T extends JsqlDataShape<"view"> ? T : null

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

export type JsqlSchemaReplaceSet<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Set extends JsqlDataShape | null,
> = Schema extends JsqlSchemaShape
	? Set extends null
		? ReplaceProp<Schema, "sets", Omit<Schema["sets"], Name>>
		: ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Name, Set>>
	: null

export type JsqlDbReplaceSet<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Set extends JsqlDataShape | null,
> = JsqlDbReplaceSchema<Db, Schema, JsqlSchemaReplaceSet<JsqlDbGetSchema<Db, Schema>, Name, Set>>

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

export type JsqlTableReplaceColumn<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	SqlType extends string,
	Facts,
> =
	Table extends JsqlDataShape<"table">
		? ReplaceProp<
				ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Col, SqlType>>,
				"column_facts",
				Facts extends null | undefined
					? Table["column_facts"] extends infer Existing
						? Existing extends Record<string, unknown>
							? Omit<Existing, Col>
							: Existing
						: Table["column_facts"]
					: ReplaceProp<
							Table["column_facts"] extends Record<string, unknown> ? Table["column_facts"] : {},
							Col,
							Facts
						>
			>
		: null

export type JsqlTableRemoveColumn<Table extends JsqlDataShape<"table"> | null, Col extends string> =
	Table extends JsqlDataShape<"table">
		? ReplaceProp<
				ReplaceProp<Table, "columns", Omit<Table["columns"], Col>>,
				"column_facts",
				Omit<Table["column_facts"], Col>
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
	Col extends string,
> = JsqlDataGetColumnType<JsqlSchemaGetTable<Schema, Tab>, Col>

export type JsqlSchemaGetColumnFacts<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlTableGetColumnFacts<JsqlSchemaGetTable<Schema, Tab>, Col>

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

export type JsqlSchemaReplaceColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	SqlType extends string,
	Facts,
> = Schema extends JsqlSchemaShape
	? JsqlTableReplaceColumn<JsqlSchemaGetTable<Schema, Tab>, Col, SqlType, Facts> extends infer UpdatedTable extends
			JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaRemoveColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = Schema extends JsqlSchemaShape
	? JsqlTableRemoveColumn<JsqlSchemaGetTable<Schema, Tab>, Col> extends infer UpdatedTable extends
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
> = Schema extends JsqlSchemaShape
	? JsqlTableReplaceColumnNullability<
			JsqlSchemaGetTable<Schema, Tab>,
			Col,
			Nullability
		> extends infer UpdatedTable extends JsqlDataShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

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

export type JsqlDbGetColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnType<JsqlDbGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnFacts<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnFacts<JsqlDbGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnNullability<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnNullability<JsqlDbGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnDefault<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnDefault<JsqlDbGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbReplaceColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	SqlType extends string,
	Facts,
> =
	JsqlSchemaReplaceColumn<JsqlDbGetSchema<Db, Sch>, Tab, Col, SqlType, Facts> extends infer UpdatedSchema extends
		JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbRemoveColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	JsqlSchemaRemoveColumn<JsqlDbGetSchema<Db, Sch>, Tab, Col> extends infer UpdatedSchema extends JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbReplaceColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	SqlType extends string,
> =
	JsqlSchemaReplaceColumnType<JsqlDbGetSchema<Db, Sch>, Tab, Col, SqlType> extends infer UpdatedSchema extends
		JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbReplaceColumnNullability<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> =
	JsqlSchemaReplaceColumnNullability<
		JsqlDbGetSchema<Db, Sch>,
		Tab,
		Col,
		Nullability
	> extends infer UpdatedSchema extends JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbReplaceColumnDefault<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	HasDefault extends true | null,
> =
	JsqlSchemaReplaceColumnDefault<JsqlDbGetSchema<Db, Sch>, Tab, Col, HasDefault> extends infer UpdatedSchema extends
		JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null
