import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape, JsqlTypeShape } from "./jsql-shapes.ts"
import type { DialectFact } from "./dialect.ts"
import type { OmitProp, ReplaceProp } from "./type-utils.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"

export type JsqlCreateSchema = {
	sets: {}
}

export type JsqlCreateTable<
	Columns extends Record<string, SqlTypeShape>,
	Facts extends Record<string, unknown> | null = null,
	Constraints extends Record<string, unknown> | null = null,
	Order extends readonly string[] = readonly string[],
	Spelled = {},
> = {} extends Spelled
	? { kind: "table"; columns: Columns; column_facts: Facts; constraints: Constraints; order: Order }
	: { kind: "table"; columns: Columns; column_facts: Facts; constraints: Constraints; order: Order; spelled: Spelled }

/**
 * A SQLite table with a rowid: `rowid`, `oid` and `_rowid_` are selectable from it (SQLT-15). `Alias` is the name of
 * its INTEGER PRIMARY KEY column (SQLT-13), which is the result key of an unaliased `rowid` (SQLT-15).
 */
export type JsqlCreateRowidTable<
	Columns extends Record<string, SqlTypeShape>,
	Facts extends Record<string, unknown> | null = null,
	Alias extends string = never,
	Order extends readonly string[] = readonly string[],
	Spelled = {},
> = {
	kind: "table"
	columns: Columns
	column_facts: Facts
	constraints: null
	rowid_table: true
	order: Order
} & ([Alias] extends [never] ? {} : { rowid_alias: Alias }) &
	({} extends Spelled ? {} : { spelled: Spelled })

export type JsqlCreateView<
	Columns extends Record<string, SqlTypeShape>,
	Order extends readonly string[] = readonly string[],
> = {
	kind: "view"
	columns: Columns
	order: Order
}

/** The result key of column `Key` of `Data`: its declared spelling in SQLite (SQLT-28, #151), else the key. */
export type JsqlColumnResultKey<Data, Key extends string> = Data extends { spelled: infer S }
	? Key extends keyof S
		? S[Key] & string
		: Key
	: Key

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

/** `Db` with the property `K` set to `V` (#192: never `Db & { … }` or `Omit<Db, …>`, which keep pointing at `Db`). */
export type JsqlDbSetProp<Db, K extends keyof JsqlDatabaseShape, V> =
	ReplaceProp<Db, K, V> extends infer R extends JsqlDatabaseShape ? R : never

/** `Db` without the properties `K` (#192: not `Omit`, see {@link JsqlDbSetProp}). */
export type JsqlDbOmitProps<Db, K extends keyof JsqlDatabaseShape> =
	OmitProp<Db, K> extends infer R extends JsqlDatabaseShape ? R : never

export type JsqlDbReplaceSchema<
	Db extends JsqlDatabaseShape,
	Name extends string,
	Schema extends JsqlSchemaShape | null,
> = (
	Schema extends null
		? ReplaceProp<Db, "schemas", OmitProp<Db["schemas"], Name>>
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
		? ReplaceProp<Schema, "sets", OmitProp<Schema["sets"], Name>>
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
		? ReplaceProp<Schema, "types", OmitProp<Schema["types"], Name>>
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

/**
 * A type of the chain by name (PGT-13, PGT-22): the schema given, else the default schema, else any schema.
 * #192: the result ends up in column types, so its object types must not name `Db` (an object type keeps every
 * type parameter its text names, and a column that keeps the state it was made in chains all the states).
 */
export type JsqlDbFindUserType<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> =
	JsqlDbGetType<Db, Schema, Name> extends infer A
		? [A] extends [null]
			? JsqlDbGetType<Db, Db["defaultSchema"], Name> extends infer B
				? [B] extends [null]
					? FindTypeInAnySchema<Db, Name>
					: FoundUserType<Db["defaultSchema"], B>
				: never
			: FoundUserType<Schema, A>
		: never

type FoundUserType<Schema, Type> = { schema: Schema; type: Type }

type FindTypeInAnySchema<Db extends JsqlDatabaseShape, Name extends string> = {
	[S in keyof Db["schemas"] & string]: JsqlDbGetType<Db, S, Name> extends infer T
		? [T] extends [null]
			? never
			: FoundUserType<S, T>
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
		? JsqlSchemaReplaceType<Schema, Name, JsqlEnumType<Values>>
		: null

export type JsqlDbReplaceEnum<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Values extends readonly string[] | null,
> = JsqlDbReplaceSchema<Db, Schema, JsqlSchemaReplaceEnum<JsqlDbGetSchema<Db, Schema>, Name, Values>>

/** The schema state's enum and domain types (#192: aliases of their parts, see `ReplaceProp`). */
type JsqlEnumType<Values extends readonly string[]> = { kind: "enum"; values: Values }
export type JsqlDomainType<Base extends SqlTypeShape, NotNull extends boolean> = {
	kind: "domain"
	base: Base
	notNull: NotNull
}

/** The `constraints` of a table with named constraints (#192: an alias of its parts, see `ReplaceProp`). */
export type JsqlConstraints<Names extends string> = { names: Names }

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
		? ReplaceProp<Tbl, "constraints", JsqlConstraints<ConstraintNames<Tbl> | Name>> extends infer NewTbl extends
				JsqlDataShape
			? JsqlDbReplaceData<Db, Sch, Tab, NewTbl>
			: Db
		: Db

/** PGT-25: `ALTER TABLE … DROP CONSTRAINT name`. */
export type JsqlDbDropConstraintName<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
		? ReplaceProp<
				Tbl,
				"constraints",
				JsqlConstraints<Exclude<ConstraintNames<Tbl>, Name>>
			> extends infer NewTbl extends JsqlDataShape
			? JsqlDbReplaceData<Db, Sch, Tab, NewTbl>
			: Db
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
	JsqlDbGetColumnType,
	JsqlDbReplaceColumn,
	JsqlDbRenameColumn,
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
											OmitProp<Cols, EnumColumnNames<Sets[T], Name, Sch> & string>
										>,
										"column_facts",
										Sets[T] extends { column_facts: infer F }
											? F extends object
												? OmitProp<F, EnumColumnNames<Sets[T], Name, Sch> & string>
												: F
											: null
									>
								: Sets[T]
					}
				>
			: Db["schemas"][S]
	}
>
