import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape, JsqlColumnFactsEntry } from "./jsql-shapes.ts"
import type { ReplaceProp } from "./type-utils.ts"
import type { SqlTypeShape, NonNull } from "./sql-type-shape.ts"
import type { JsqlDbGetSchema, JsqlDbReplaceSchema, JsqlSchemaGetTable, JsqlSchemaReplaceData } from "./jsql-utils.ts"

export type JsqlDataGetColumnType<Data extends JsqlDataShape | null, Col extends string> = Data extends JsqlDataShape
	? Col extends keyof Data["columns"]
		? Data["columns"][Col & keyof Data["columns"]]
		: null
	: null

type JsqlTableGetColumnFacts<Table extends JsqlDataShape<"table"> | null, Col extends string> =
	Table extends JsqlDataShape<"table">
		? Table["column_facts"] extends infer Facts
			? Facts extends Record<string, unknown>
				? Col extends keyof Facts
					? Facts[Col & keyof Facts]
					: null
				: null
			: null
		: null

type JsqlTableReplaceColumn<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	Column extends JsqlColumnShape | SqlTypeShape | null,
> =
	Table extends JsqlDataShape<"table">
		? Column extends JsqlColumnFactsEntry & { type: SqlTypeShape }
			? ReplaceProp<
					ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Col, Column["type"]>>,
					"column_facts",
					ReplaceProp<
						Table["column_facts"] extends Record<string, unknown> ? Table["column_facts"] : {},
						Col,
						Omit<Column, "type">
					>
				>
			: Column extends SqlTypeShape
				? ReplaceProp<Table, "columns", ReplaceProp<Table["columns"], Col, Column>>
				: ReplaceProp<
						ReplaceProp<Table, "columns", Omit<Table["columns"], Col>>,
						"column_facts",
						Omit<Table["column_facts"], Col>
					>
		: null

type JsqlTableReplaceColumnType<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	SqlType extends SqlTypeShape,
> =
	Table extends JsqlDataShape<"table">
		? Col extends keyof Table["columns"]
			? // `ALTER COLUMN … TYPE` keeps NOT NULL (PGT-19)
				ReplaceProp<
					Table,
					"columns",
					ReplaceProp<
						Table["columns"],
						Col,
						Table["columns"][Col] extends { nullable: false } ? NonNull<SqlType> : SqlType
					>
				>
			: null
		: null

/** The column's own type changes with NOT NULL (SET NOT NULL, a primary key added later: PGT-19), and the fact is kept for INSERT. */
type JsqlTableReplaceColumnNullability<
	Table extends JsqlDataShape<"table"> | null,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> =
	JsqlTableReplaceColumnNullabilityFact<Table, Col, Nullability> extends infer T extends JsqlDataShape<"table">
		? Nullability extends "not_null" | "nullable"
			? ReplaceProp<
					T,
					"columns",
					ReplaceProp<
						T["columns"],
						Col,
						T["columns"][Col & keyof T["columns"]] extends infer Ty extends SqlTypeShape
							? {
									type: Ty["type"]
									arg: Ty["arg"]
									nullable: Nullability extends "not_null" ? false : true
								}
							: never
					>
				>
			: T
		: null

type JsqlTableReplaceColumnNullabilityFact<
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

type JsqlTableReplaceColumnDefault<
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

type JsqlSchemaGetColumnType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlDataGetColumnType<JsqlSchemaGetTable<Schema, Tab>, Col>

type JsqlColumnShape = JsqlColumnFactsEntry & { type: SqlTypeShape }

type JsqlTableGetColumn<Table extends JsqlDataShape<"table"> | null, Name extends string> =
	JsqlDataGetColumnType<Table, Name> extends infer Type extends SqlTypeShape
		? { type: Type } & (JsqlTableGetColumnFacts<Table, Name> extends infer Facts extends {} ? Facts : {})
		: null

type JsqlSchemaGetColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
> = JsqlTableGetColumn<JsqlSchemaGetTable<Schema, Tab>, Col>

type JsqlSchemaReplaceColumn<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	Column extends JsqlColumnShape | SqlTypeShape | null,
> = JsqlSchemaReplaceData<Schema, Tab, JsqlTableReplaceColumn<JsqlSchemaGetTable<Schema, Tab>, Col, Column>>

type JsqlSchemaReplaceColumnType<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	SqlType extends SqlTypeShape,
> = JsqlSchemaReplaceData<Schema, Tab, JsqlTableReplaceColumnType<JsqlSchemaGetTable<Schema, Tab>, Col, SqlType>>

type JsqlSchemaReplaceColumnNullability<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	Nullability extends "not_null" | "nullable" | null,
> = JsqlSchemaReplaceData<
	Schema,
	Tab,
	JsqlTableReplaceColumnNullability<JsqlSchemaGetTable<Schema, Tab>, Col, Nullability>
>

type JsqlSchemaReplaceColumnDefault<
	Schema extends JsqlSchemaShape | null,
	Tab extends string,
	Col extends string,
	HasDefault extends true | null,
> = JsqlSchemaReplaceData<Schema, Tab, JsqlTableReplaceColumnDefault<JsqlSchemaGetTable<Schema, Tab>, Col, HasDefault>>

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

export type JsqlDbReplaceColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	Column extends JsqlColumnShape | SqlTypeShape | null,
> = JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name, Column>>

export type JsqlDbReplaceColumnType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	SqlType extends SqlTypeShape,
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
