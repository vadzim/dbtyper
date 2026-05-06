import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "./jsql-shapes.ts"

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
