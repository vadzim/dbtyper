import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "./jsql-shapes.ts"
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
	Type extends JsqlTableShape,
> = Schema extends JsqlSchemaShape ? ReplaceProp<Schema, "types", ReplaceProp<Schema["types"], Name, Type>> : null

export type JsqlDbReplaceType<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Type extends JsqlTableShape,
> = JsqlReplaceType<JsqlGetSchema<Db, Schema>, Name, Type>

export type JsqlRemoveType<Schema extends JsqlSchemaShape | null, Name extends string> = Schema extends JsqlSchemaShape
	? ReplaceProp<Schema, "types", Omit<Schema["types"], Name>>
	: null

export type JsqlDbRemoveType<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlRemoveType<
	JsqlGetSchema<Db, Schema>,
	Name
>
