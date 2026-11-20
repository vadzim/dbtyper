import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape, JsqlTypeShape } from "./jsql-shapes.ts"
import type { DialectFact } from "./dialect.ts"
import type { ReplaceProp } from "./type-utils.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"

export type JsqlCreateSchema = {
	sets: {}
}

export type JsqlCreateTable<
	Columns extends Record<string, SqlTypeShape>,
	Facts extends Record<string, unknown> | null = null,
	Constraints extends Record<string, unknown> | null = null,
> = {
	kind: "table"
	columns: Columns
	column_facts: Facts
	constraints: Constraints
}

/**
 * A SQLite table with a rowid: `rowid`, `oid` and `_rowid_` are selectable from it (SQLT-15). `Alias` is the name of
 * its INTEGER PRIMARY KEY column (SQLT-13), which is the result key of an unaliased `rowid` (SQLT-15).
 */
export type JsqlCreateRowidTable<
	Columns extends Record<string, SqlTypeShape>,
	Facts extends Record<string, unknown> | null = null,
	Alias extends string = never,
> = {
	kind: "table"
	columns: Columns
	column_facts: Facts
	constraints: null
	rowid_table: true
} & ([Alias] extends [never] ? {} : { rowid_alias: Alias })

export type JsqlCreateView<Columns extends Record<string, SqlTypeShape>> = {
	kind: "view"
	columns: Columns
}

export type JsqlDbGetSchema<Db extends JsqlDatabaseShape, Sch extends string> = Sch extends keyof Db["schemas"]
	? Db["schemas"][Sch & keyof Db["schemas"]] & JsqlSchemaShape
	: null

type JsqlSchemaGetData<Schema extends JsqlSchemaShape | null, Tab extends string> = Schema extends JsqlSchemaShape
	? Tab extends keyof Schema["sets"]
		? Schema["sets"][Tab & keyof Schema["sets"]]
		: null
	: null

export type JsqlDbGetData<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string> = JsqlSchemaGetData<
	JsqlDbGetSchema<Db, Sch>,
	Tab
>

type JsqlSchemaGetType<Schema extends JsqlSchemaShape | null, Tab extends string> = Schema extends JsqlSchemaShape
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

type JsqlSchemaReplaceType<
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

type JsqlSchemaGetEnum<Schema extends JsqlSchemaShape | null, Name extends string> =
	JsqlSchemaGetType<Schema, Name> extends infer T ? (T extends { kind: "enum"; values: infer V } ? V : null) : null

export type JsqlDbGetEnum<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = JsqlSchemaGetEnum<
	JsqlDbGetSchema<Db, Schema>,
	Name
>

/** A type of the chain by name (PGT-13, PGT-22): the schema given, else the default schema, else any schema. */
export type JsqlDbFindUserType<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> =
	JsqlDbGetType<Db, Schema, Name> extends infer A
		? [A] extends [null]
			? JsqlDbGetType<Db, Db["defaultSchema"], Name> extends infer B
				? [B] extends [null]
					? FindTypeInAnySchema<Db, Name>
					: { schema: Db["defaultSchema"]; type: B }
				: never
			: { schema: Schema; type: A }
		: never

type FindTypeInAnySchema<Db extends JsqlDatabaseShape, Name extends string> = {
	[S in keyof Db["schemas"] & string]: JsqlDbGetType<Db, S, Name> extends infer T
		? [T] extends [null]
			? never
			: { schema: S; type: T }
		: never
}[keyof Db["schemas"] & string]

/** The labels of the enum `[name, schema]` (the arg of an enum shape) as a union, `unknown` when it is gone. */
export type JsqlEnumLabelUnion<Db, Arg> = [Db] extends [never]
	? unknown
	: Db extends JsqlDatabaseShape
		? Arg extends readonly [infer N extends string, infer S extends string]
			? JsqlDbGetEnum<Db, S, N> extends infer V extends readonly string[]
				? V[number]
				: unknown
			: unknown
		: unknown

type JsqlSchemaReplaceEnum<
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

/** PGT-25: the names of a table's named constraints (`constraints: { names }`), or `never`. */
type ConstraintNames<Tbl> = Tbl extends { constraints: { names: infer N extends string } } ? N : never

/** PGT-25: `ALTER TABLE … ADD CONSTRAINT name`: the name is known to `ON CONFLICT ON CONSTRAINT`. */
export type JsqlDbAddConstraintName<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
		? JsqlDbReplaceData<
				Db,
				Sch,
				Tab,
				Omit<Tbl, "constraints"> & { constraints: { names: ConstraintNames<Tbl> | Name } }
			>
		: Db

/** PGT-25: `ALTER TABLE … DROP CONSTRAINT name`. */
export type JsqlDbDropConstraintName<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
		? JsqlDbReplaceData<
				Db,
				Sch,
				Tab,
				Omit<Tbl, "constraints"> & { constraints: { names: Exclude<ConstraintNames<Tbl>, Name> } }
			>
		: Db

/**
 * The schema an UNQUALIFIED table or view name is looked up in: the default schema, except where the dialect has temp objects
 * (`tempObjects`), which are searched first (SQLT-25).
 */
export type UnqualifiedSchema<Db extends JsqlDatabaseShape, Name extends string> =
	DialectFact<Db, "tempObjects"> extends true
		? JsqlDbGetData<Db, "temp", Name> extends null
			? Db["defaultSchema"]
			: "temp"
		: Db["defaultSchema"]

export type {
	JsqlDataGetColumnType,
	JsqlDbGetColumn,
	JsqlDbGetColumnType,
	JsqlDbReplaceColumn,
	JsqlDbReplaceColumnType,
	JsqlDbReplaceColumnNullability,
	JsqlDbReplaceColumnDefault,
} from "./jsql-columns.ts"

/** TYPE-18: the column is the enum `[name, schema]`, or an array of it. */
type IsEnumColumn<Col, Name extends string, Sch extends string> = Col extends {
	type: "enum"
	arg: readonly [Name, Sch]
}
	? true
	: Col extends { type: "array"; arg: infer Elem }
		? IsEnumColumn<Elem, Name, Sch>
		: false

type EnumColumnNames<Data, Name extends string, Sch extends string> = Data extends { columns: infer Cols }
	? { [C in keyof Cols]: IsEnumColumn<Cols[C], Name, Sch> extends true ? C : never }[keyof Cols]
	: never

type EnumUserSets<Db extends JsqlDatabaseShape, Name extends string, Sch extends string> = {
	[S in keyof Db["schemas"]]: Db["schemas"][S] extends { sets: infer Sets }
		? { [T in keyof Sets]: [EnumColumnNames<Sets[T], Name, Sch>] extends [never] ? never : T }[keyof Sets]
		: never
}[keyof Db["schemas"]]

/** TYPE-18: some column of a table or view of the chain has the enum `Sch.Name` (PostgreSQL refuses to drop it). */
export type JsqlDbEnumInUse<Db extends JsqlDatabaseShape, Sch extends string, Name extends string> = [
	EnumUserSets<Db, Name, Sch>,
] extends [never]
	? false
	: true

/**
 * TYPE-18, DROP TYPE … CASCADE as in PostgreSQL: the columns of the enum go from their tables, and the views that
 * select such a column go as a whole.
 */
export type JsqlDbDropEnumUsers<Db extends JsqlDatabaseShape, Sch extends string, Name extends string> = ReplaceProp<
	Db,
	"schemas",
	{
		[S in keyof Db["schemas"]]: Db["schemas"][S] extends { sets: infer Sets }
			? ReplaceProp<
					Db["schemas"][S],
					"sets",
					{
						[
							T in keyof Sets as Sets[T] extends { kind: "view" }
								? [EnumColumnNames<Sets[T], Name, Sch>] extends [never]
									? T
									: never
								: T
						]: [EnumColumnNames<Sets[T], Name, Sch>] extends [never]
							? Sets[T]
							: Sets[T] extends { columns: infer Cols }
								? ReplaceProp<
										ReplaceProp<
											Sets[T],
											"columns",
											Omit<Cols, EnumColumnNames<Sets[T], Name, Sch> & string>
										>,
										"column_facts",
										Sets[T] extends { column_facts: infer F }
											? F extends object
												? Omit<F, EnumColumnNames<Sets[T], Name, Sch> & string>
												: F
											: null
									>
								: Sets[T]
					}
				>
			: Db["schemas"][S]
	}
>
