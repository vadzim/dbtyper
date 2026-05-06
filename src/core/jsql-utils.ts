import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape, JsqlTypeShape } from "./jsql-shapes.ts"
import type { ReplaceProp } from "./type-utils.ts"

export type JsqlGetSchema<Db extends JsqlDatabaseShape, Sch extends string> = Sch extends keyof Db["schemas"]
	? Db["schemas"][Sch & keyof Db["schemas"]] & JsqlSchemaShape
	: null

export type JsqlGetSet<Schema extends JsqlSchemaShape | null, Tab extends string> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["sets"]
		? Schema["sets"][Tab & keyof Schema["sets"]]
		: null
	: null

export type JsqlDbGetSet<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlGetSet<
	JsqlGetSchema<Db, Sch>,
	Tab
>

export type JsqlGetType<Schema extends JsqlSchemaShape | null, Tab extends string> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["types"]
		? Schema["types"][Tab & keyof Schema["types"]]
		: null
	: null

export type JsqlDbGetType<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlGetType<
	JsqlGetSchema<Db, Sch>,
	Tab
>

export type JsqlGetTable<Schema extends JsqlSchemaShape | null, Tab extends string> =
	JsqlGetSet<Schema, Tab> extends infer T extends JsqlTableShape<"table"> ? T : null

export type JsqlDbGetTable<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlGetTable<
	JsqlGetSchema<Db, Sch>,
	Tab
>

export type JsqlGetView<Schema extends JsqlSchemaShape | null, Tab extends string> =
	JsqlGetSet<Schema, Tab> extends infer T extends JsqlTableShape<"view"> ? T : null

export type JsqlDbGetView<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlGetView<
	JsqlGetSchema<Db, Sch>,
	Tab
>

export type JsqlReplaceSchema<
	Db extends JsqlDatabaseShape,
	Name extends string,
	Schema extends JsqlSchemaShape,
> = ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Name, Schema>>

export type JsqlRemoveSchema<Db extends JsqlDatabaseShape, Name extends string> = ReplaceProp<
	Db,
	"schemas",
	Omit<Db["schemas"], Name>
>

export type JsqlReplaceSet<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Set extends JsqlTableShape,
> = Schema extends JsqlSchemaShape ? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Name, Set>> : null

export type JsqlDbReplaceSet<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Set extends JsqlTableShape,
> = JsqlReplaceSet<JsqlGetSchema<Db, Schema>, Name, Set>

export type JsqlRemoveSet<Schema extends JsqlSchemaShape | null, Name extends string> = Schema extends JsqlSchemaShape
	? ReplaceProp<Schema, "sets", Omit<Schema["sets"], Name>>
	: null

export type JsqlDbRemoveSet<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlRemoveSet<
	JsqlGetSchema<Db, Schema>,
	Name
>

export type JsqlReplaceType<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Type extends JsqlTypeShape,
> = Schema extends JsqlSchemaShape ? ReplaceProp<Schema, "types", ReplaceProp<Schema["types"], Name, Type>> : null

export type JsqlDbReplaceType<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Type extends JsqlTypeShape,
> = JsqlReplaceType<JsqlGetSchema<Db, Schema>, Name, Type>

export type JsqlRemoveType<Schema extends JsqlSchemaShape | null, Name extends string> = Schema extends JsqlSchemaShape
	? ReplaceProp<Schema, "types", Omit<Schema["types"], Name>>
	: null

export type JsqlDbRemoveType<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlRemoveType<
	JsqlGetSchema<Db, Schema>,
	Name
>

export type JsqlGetEnum<Schema extends JsqlSchemaShape | null, Name extends string> =
	JsqlGetType<Schema, Name> extends infer T ? (T extends { kind: "enum"; values: infer V } ? V : null) : null

export type JsqlDbGetEnum<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlGetEnum<
	JsqlGetSchema<Db, Schema>,
	Name
>

export type JsqlReplaceEnum<
	Schema extends JsqlSchemaShape | null,
	Name extends string,
	Values extends readonly string[],
> = JsqlReplaceType<Schema, Name, { kind: "enum"; values: Values }>

export type JsqlDbReplaceEnum<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Values extends readonly string[],
> = JsqlReplaceEnum<JsqlGetSchema<Db, Schema>, Name, Values>

export type JsqlRemoveEnum<Schema extends JsqlSchemaShape | null, Name extends string> = JsqlRemoveType<Schema, Name>

export type JsqlDbRemoveEnum<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlRemoveEnum<
	JsqlGetSchema<Db, Schema>,
	Name
>

export type JsqlGetColumnType<Table extends JsqlTableShape<"table"> | null, Col extends string> =
	Table extends JsqlTableShape<"table">
		? Col extends keyof Table["columns"]
			? Table["columns"][Col & keyof Table["columns"]]
			: null
		: null

export type JsqlGetColumnFacts<Table extends JsqlTableShape<"table"> | null, Col extends string> =
	Table extends JsqlTableShape<"table">
		? Table["column_facts"] extends infer Facts
			? Facts extends Record<string, unknown>
				? Col extends keyof Facts
					? Facts[Col & keyof Facts]
					: null
				: null
			: null
		: null

export type JsqlGetColumnNullability<Table extends JsqlTableShape<"table"> | null, Col extends string> =
	Table extends JsqlTableShape<"table">
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

export type JsqlGetColumnDefault<Table extends JsqlTableShape<"table"> | null, Col extends string> =
	Table extends JsqlTableShape<"table">
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

export type JsqlReplaceColumn<
	Table extends JsqlTableShape<"table"> | null,
	Col extends string,
	SqlType extends string,
	Facts,
> =
	Table extends JsqlTableShape<"table">
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

export type JsqlRemoveColumn<Table extends JsqlTableShape<"table"> | null, Col extends string> =
	Table extends JsqlTableShape<"table">
		? ReplaceProp<
				ReplaceProp<Table, "columns", Omit<Table["columns"], Col>>,
				"column_facts",
				Omit<Table["column_facts"], Col>
			>
		: null

export type JsqlReplaceColumnType<
	Table extends JsqlTableShape<"table"> | null,
	Col extends string,
	SqlType extends string,
> =
	Table extends JsqlTableShape<"table">
		? Col extends keyof Table["columns"]
			? ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Col, SqlType>>
			: null
		: null

export type JsqlReplaceColumnNullability<
	Table extends JsqlTableShape<"table"> | null,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> =
	Table extends JsqlTableShape<"table">
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

export type JsqlReplaceColumnDefault<
	Table extends JsqlTableShape<"table"> | null,
	Col extends string,
	HasDefault extends true | null,
> =
	Table extends JsqlTableShape<"table">
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
> = JsqlGetColumnType<JsqlGetTable<Schema, Tab>, Col>

export type JsqlSchemaGetColumnFacts<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlGetColumnFacts<JsqlGetTable<Schema, Tab>, Col>

export type JsqlSchemaGetColumnNullability<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlGetColumnNullability<JsqlGetTable<Schema, Tab>, Col>

export type JsqlSchemaGetColumnDefault<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlGetColumnDefault<JsqlGetTable<Schema, Tab>, Col>

export type JsqlSchemaReplaceColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	SqlType extends string,
	Facts,
> = Schema extends JsqlSchemaShape
	? JsqlReplaceColumn<JsqlGetTable<Schema, Tab>, Col, SqlType, Facts> extends infer UpdatedTable extends
			JsqlTableShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaRemoveColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = Schema extends JsqlSchemaShape
	? JsqlRemoveColumn<JsqlGetTable<Schema, Tab>, Col> extends infer UpdatedTable extends JsqlTableShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumnType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	SqlType extends string,
> = Schema extends JsqlSchemaShape
	? JsqlReplaceColumnType<JsqlGetTable<Schema, Tab>, Col, SqlType> extends infer UpdatedTable extends
			JsqlTableShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumnNullability<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> = Schema extends JsqlSchemaShape
	? JsqlReplaceColumnNullability<JsqlGetTable<Schema, Tab>, Col, Nullability> extends infer UpdatedTable extends
			JsqlTableShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlSchemaReplaceColumnDefault<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	HasDefault extends true | null,
> = Schema extends JsqlSchemaShape
	? JsqlReplaceColumnDefault<JsqlGetTable<Schema, Tab>, Col, HasDefault> extends infer UpdatedTable extends
			JsqlTableShape<"table">
		? ReplaceProp<Schema, "sets", ReplaceProp<Schema["sets"], Tab, UpdatedTable>>
		: null
	: null

export type JsqlDbGetColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnType<JsqlGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnFacts<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnFacts<JsqlGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnNullability<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnNullability<JsqlGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbGetColumnDefault<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> = JsqlSchemaGetColumnDefault<JsqlGetSchema<Db, Sch>, Tab, Col>

export type JsqlDbReplaceColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	SqlType extends string,
	Facts,
> =
	JsqlSchemaReplaceColumn<JsqlGetSchema<Db, Sch>, Tab, Col, SqlType, Facts> extends infer UpdatedSchema extends
		JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbRemoveColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
> =
	JsqlSchemaRemoveColumn<JsqlGetSchema<Db, Sch>, Tab, Col> extends infer UpdatedSchema extends JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null

export type JsqlDbReplaceColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	SqlType extends string,
> =
	JsqlSchemaReplaceColumnType<JsqlGetSchema<Db, Sch>, Tab, Col, SqlType> extends infer UpdatedSchema extends
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
		JsqlGetSchema<Db, Sch>,
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
	JsqlSchemaReplaceColumnDefault<JsqlGetSchema<Db, Sch>, Tab, Col, HasDefault> extends infer UpdatedSchema extends
		JsqlSchemaShape
		? ReplaceProp<Db, "schemas", ReplaceProp<Db["schemas"], Sch, UpdatedSchema>>
		: null
