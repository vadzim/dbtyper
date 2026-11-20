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
	Order extends readonly string[] = readonly string[],
	Spelled = {},
	PkColumns extends string = never,
	PkName extends string = never,
> = [PkColumns] extends [never]
	? {} extends Spelled
		? { kind: "table"; columns: Columns; column_facts: Facts; constraints: Constraints; order: Order }
		: {
				kind: "table"
				columns: Columns
				column_facts: Facts
				constraints: Constraints
				order: Order
				spelled: Spelled
			}
	: {} extends Spelled
		? {
				kind: "table"
				columns: Columns
				column_facts: Facts
				constraints: Constraints
				order: Order
				primary_key: { columns: PkColumns; name: PkName }
			}
		: {
				kind: "table"
				columns: Columns
				column_facts: Facts
				constraints: Constraints
				order: Order
				spelled: Spelled
				primary_key: { columns: PkColumns; name: PkName }
			}

/**
 * The PRIMARY KEY of a table (CORE-15, SEL-27): its columns (a union of keys) and its constraint name, which
 * `DROP CONSTRAINT` matches (PostgreSQL names an unnamed one `<table>_pkey`). A table without one has no field.
 */
export type JsqlPrimaryKey = { columns: string; name: string }

/** The PRIMARY KEY of a table shape, or `null`. */
export type JsqlTablePrimaryKey<Tbl> = Tbl extends { primary_key: infer P extends JsqlPrimaryKey } ? P : null

/** The table with PRIMARY KEY `Pk` (`null` removes it). */
export type JsqlTableWithPrimaryKey<Tbl, Pk extends JsqlPrimaryKey | null> = [Pk] extends [JsqlPrimaryKey]
	? ReplaceProp<Tbl, "primary_key", { columns: Pk["columns"]; name: Pk["name"] }>
	: Tbl extends { primary_key: unknown }
		? Omit<Tbl, "primary_key">
		: Tbl

/** `ALTER TABLE … ADD [CONSTRAINT name] PRIMARY KEY` or `ADD COLUMN … PRIMARY KEY` (CORE-15): the table gets `Pk`. */
export type JsqlDbSetPrimaryKey<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Pk extends JsqlPrimaryKey | null,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
		? JsqlTableWithPrimaryKey<Tbl, Pk> extends infer T extends JsqlDataShape
			? JsqlDbReplaceData<Db, Sch, Tab, T>
			: Db
		: Db

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
	Spelled = {},
> = {} extends Spelled
	? { kind: "view"; columns: Columns; order: Order }
	: { kind: "view"; columns: Columns; order: Order; spelled: Spelled }

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

/** TYPE-18, #179: column `Col` of the table has the domain or composite type `Decl` (`schema.name`). */
export type JsqlDbSetUserType<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Col extends string,
	Decl extends string,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
		? ReplaceProp<
				Tbl,
				"user_types",
				WithEntry<Tbl extends { user_types: infer U } ? U : {}, Col, Decl>
			> extends infer T extends JsqlDataShape
			? JsqlDbReplaceData<Db, Sch, Tab, T>
			: Db
		: Db

/** `M` with the entry `Name: V` (one flat object, not an intersection). */
export type WithEntry<M, Name extends string, V> = {
	[K in keyof M | Name]: K extends Name ? V : K extends keyof M ? M[K] : never
}

/** #179: the columns each named constraint involves (`constraints.columns`: name -> union of columns), or `{}`. */
type ConstraintColumns<Tbl> = Tbl extends { constraints: { columns: infer C } } ? C : {}

/**
 * #179: the named constraint `Name` of the table involves the columns `Cols` (PRIMARY KEY, UNIQUE, FOREIGN KEY: their
 * list; CHECK: the table's columns its expression names). PostgreSQL drops it with any of them (`DROP COLUMN`).
 */
export type JsqlDbSetConstraintColumns<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	Cols extends string,
> = [Name] extends [never]
	? Db
	: [Cols] extends [never]
		? JsqlDbAddConstraintName<Db, Sch, Tab, Name>
		: JsqlDbGetData<Db, Sch, Tab> extends infer Tbl extends JsqlDataShape
			? JsqlDbReplaceData<
					Db,
					Sch,
					Tab,
					Omit<Tbl, "constraints"> & {
						constraints: {
							names: ConstraintNames<Tbl> | Name
							columns: WithEntry<ConstraintColumns<Tbl>, Name, Cols>
						}
					}
				>
			: Db

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
				Omit<Tbl, "constraints"> & {
					constraints: { names: ConstraintNames<Tbl> | Name; columns: ConstraintColumns<Tbl> }
				}
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
		? JsqlTableWithPrimaryKey<Tbl, DropPkByName<Tbl, Name>> extends infer T extends JsqlDataShape
			? JsqlDbReplaceData<
					Db,
					Sch,
					Tab,
					Omit<T, "constraints"> & {
						constraints: {
							names: Exclude<ConstraintNames<Tbl>, Name>
							columns: Omit<ConstraintColumns<Tbl>, Name>
						}
					}
				>
			: Db
		: Db

/** The table's PRIMARY KEY after `DROP CONSTRAINT Name`: gone when `Name` is its name (CORE-15). */
type DropPkByName<Tbl, Name extends string> =
	JsqlTablePrimaryKey<Tbl> extends infer P extends JsqlPrimaryKey ? (Name extends P["name"] ? null : P) : null

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
import type { JsqlTableDropColumns } from "./jsql-columns.ts"

/** TYPE-18: the column is the enum `[name, schema]`, or an array of it. */
type IsEnumColumn<Col, Name extends string, Sch extends string> = Col extends {
	type: "enum"
	arg: readonly [Name, Sch]
}
	? true
	: Col extends { type: "array"; arg: infer Elem }
		? IsEnumColumn<Elem, Name, Sch>
		: false

/**
 * TYPE-18: the columns of a table or view that use the type `Sch.Name`: an enum by the column type, a domain or
 * composite type (#179) by the table's `user_types` (a domain column's type is its base type).
 */
type TypeColumnNames<Data, Name extends string, Sch extends string, Enum extends boolean> = Enum extends true
	? Data extends { columns: infer Cols }
		? { [C in keyof Cols]: IsEnumColumn<Cols[C], Name, Sch> extends true ? C : never }[keyof Cols] & string
		: never
	: Data extends { user_types: infer U }
		? { [C in keyof U]: U[C] extends `${Sch}.${Name}` ? C : never }[keyof U] & string
		: never

type TypeUserSets<Db extends JsqlDatabaseShape, Name extends string, Sch extends string, Enum extends boolean> = {
	[S in keyof Db["schemas"]]: Db["schemas"][S] extends { sets: infer Sets }
		? { [T in keyof Sets]: [TypeColumnNames<Sets[T], Name, Sch, Enum>] extends [never] ? never : T }[keyof Sets]
		: never
}[keyof Db["schemas"]]

/**
 * TYPE-18: some column of a table or view of the chain has the type `Sch.Name` (PostgreSQL refuses to drop it). `Enum`:
 * the type is an enum (else a domain or composite type).
 */
export type JsqlDbTypeInUse<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Name extends string,
	Enum extends boolean,
> = [TypeUserSets<Db, Name, Sch, Enum>] extends [never] ? false : true

/**
 * TYPE-18, DROP TYPE | DOMAIN … CASCADE as in PostgreSQL: the columns of the type go from their tables (with the
 * primary key and the named constraints that involve them, #179), and the views that select an enum column go as a
 * whole.
 */
export type JsqlDbDropTypeUsers<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Name extends string,
	Enum extends boolean,
> = ReplaceProp<
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
								? [TypeColumnNames<Sets[T], Name, Sch, Enum>] extends [never]
									? T
									: never
								: T
						]: JsqlTableDropColumns<Sets[T], TypeColumnNames<Sets[T], Name, Sch, Enum>>
					}
				>
			: Db["schemas"][S]
	}
>
