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
	Spelling extends string = never,
> =
	Table extends JsqlDataShape<"table">
		? WithColumnOrder<Table, JsqlTableReplaceColumnData<Table, Col, Column>, Col, Column extends null ? true : false, Spelling>
		: null

type JsqlTableReplaceColumnData<
	Table extends JsqlDataShape<"table">,
	Col extends string,
	Column extends JsqlColumnShape | SqlTypeShape | null,
> = Column extends JsqlColumnFactsEntry & { type: SqlTypeShape }
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

/** `Names` without `Name`. */
type WithoutName<Names extends readonly string[], Name extends string> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Name
		? R
		: [H, ...WithoutName<R, Name>]
	: []

/** `Names` with `Old` replaced by `New` in place. */
type RenameName<Names extends readonly string[], Old extends string, New extends string> = {
	[I in keyof Names]: Names[I] extends Old ? New : Names[I]
}

/**
 * #150, #151: keep the declaration order (a new column goes last, a dropped one leaves) and the SQLite spellings in
 * step with a column change. A table without `order` (built by hand in low-level tests) is left as it is.
 */
type WithColumnOrder<
	Old extends JsqlDataShape<"table">,
	New,
	Col extends string,
	Removing extends boolean,
	Spelling extends string,
> = Removing extends true
	? WithSpelling<
			Old extends { order: infer O extends readonly string[] } ? ReplaceProp<New, "order", WithoutName<O, Col>> : New,
			Old,
			Col,
			never
		>
	: Col extends keyof Old["columns"]
		? New
		: WithSpelling<
				Old extends { order: infer O extends readonly string[] } ? ReplaceProp<New, "order", [...O, Col]> : New,
				Old,
				Col,
				Spelling
			>

/** Sets (or, with `never`, drops) the declared spelling of `Col`; tables with no spellings stay without the field. */
type WithSpelling<T, Old, Col extends string, Spelling extends string> = [Spelling] extends [never]
	? Old extends { spelled: infer S }
		? Col extends keyof S
			? ReplaceProp<T, "spelled", Omit<S, Col>>
			: T
		: T
	: ReplaceProp<T, "spelled", (Old extends { spelled: infer S } ? Omit<S, Col> : {}) & Record<Col, Spelling>>

/** `ALTER TABLE … RENAME COLUMN Old TO New`: the column keeps its place, type and facts (#150); `Spelling` as written (SQLite). */
type JsqlTableRenameColumn<
	Table extends JsqlDataShape<"table"> | null,
	Old extends string,
	New extends string,
	Spelling extends string,
> =
	Table extends JsqlDataShape<"table">
		? JsqlTableGetColumn<Table, Old> extends infer OldCol extends JsqlColumnShape
			? JsqlTableReplaceColumnData<Table, Old, null> extends infer T0 extends JsqlDataShape<"table">
				? JsqlTableReplaceColumnData<T0, New, OldCol> extends infer T
				? WithSpelling<
						WithSpelling<
							Table extends { order: infer O extends readonly string[] }
								? ReplaceProp<T, "order", RenameName<O, Old, New>>
								: T,
							Table,
							Old,
							never
						>,
						Table,
						New,
						Spelling
					>
				: never
				: never
			: null
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
	Spelling extends string,
> = JsqlSchemaReplaceData<Schema, Tab, JsqlTableReplaceColumn<JsqlSchemaGetTable<Schema, Tab>, Col, Column, Spelling>>

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

/**
 * Adds, replaces (`Column`) or drops (`null`) a column. An added column goes last in the declaration order; its SQLite
 * spelling comes from `pendingSpelled` (set where its name was read, see `WithColumnSpelling`), which is cleared.
 */
export type JsqlDbReplaceColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Name extends string,
	Column extends JsqlColumnShape | SqlTypeShape | null,
> = Db extends { pendingSpelled: infer P }
	? JsqlDbReplaceSchema<
			Omit<Db, "pendingSpelled"> extends infer D extends JsqlDatabaseShape ? D : Db,
			Sch,
			JsqlSchemaReplaceColumn<
				JsqlDbGetSchema<Db, Sch>,
				Tab,
				Name,
				Column,
				Name extends keyof P ? P[Name] & string : never
			>
		>
	: JsqlDbReplaceSchema<Db, Sch, JsqlSchemaReplaceColumn<JsqlDbGetSchema<Db, Sch>, Tab, Name, Column, never>>

/** `ALTER TABLE … RENAME COLUMN Old TO New` (#150: the column keeps its place); `Spelling`: the new name as written (SQLite). */
export type JsqlDbRenameColumn<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Old extends string,
	New extends string,
	Spelling extends string = never,
> = JsqlDbReplaceSchema<
	Db,
	Sch,
	JsqlSchemaReplaceData<
		JsqlDbGetSchema<Db, Sch>,
		Tab,
		JsqlTableRenameColumn<JsqlSchemaGetTable<JsqlDbGetSchema<Db, Sch>, Tab>, Old, New, Spelling>
	>
>

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
