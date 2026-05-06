import type { HasKey } from "./type-utils.ts"

/** Helper to index shape types safely without causing "too deep" recursion. */
export type I<T, K extends string, R = {}> = K extends keyof T ? T[K] & R : R

export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: {}
	/** Typed SQL function names → SQL return type strings (e.g., "integer", "text"). Keys as used in SQL after identifier normalization, typically lowercase. */
	functions?: {} | undefined
}

export type JsqlSchemaShape = {
	/** Named relations in the schema (base tables and views). */
	sets: {}
	/** Named types in the schema (enums, etc.). */
	types?: {}
}

export type JsqlTypeShape = {
	kind: "enum"
	/** Enum values in order. */
	values: readonly string[]
}

export type JsqlTableShape<Kind extends "table" | "view" = "table" | "view"> = {
	kind: Kind
	/** SQL type strings per column (e.g., "text", "integer", "uuid"). */
	columns: Record<string, string>
	constraints?: {}
	column_facts?: {}
}

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = {
	kind: "select"
	/** SQL type strings per column (e.g., "text", "integer", "uuid"). */
	columns: {}
}

/** Type-level result of a parsed `INSERT` (DB state unchanged in this model). */
export type JsqlInsertStatementResult = {
	kind: "insert"
	table: string
	schema: string
	columns: readonly string[]
	/** Set when `RETURNING …` is parsed (same shape as a `SELECT` projection). */
	returning?: JsqlSelectStatementResult
	/** Set when `ON CONFLICT … DO UPDATE SET …` is parsed (assigned column names only). */
	on_conflict_update_set_columns?: readonly string[]
}

/** Type-level result of a parsed `UPDATE` (DB state unchanged in this model). */
export type JsqlUpdateStatementResult = {
	kind: "update"
	table: string
	schema: string
	/** Column names that appeared in `SET` (each assignment is type-checked). */
	set_columns: readonly string[]
}

export type JsqlConstraintEntry =
	| { kind: "primary_key"; columns: string[] }
	| { kind: "unique"; columns: string[] }
	| { kind: "foreign_key"; refs: JsqlForeignKeyRef }

export type JsqlColumnFactsEntry = {
	default?: true
	check?: true
	generated?: true | { mode: "stored" | "virtual" }
	/** Set by `ALTER COLUMN … SET NOT NULL` (type-level migration tracking). */
	not_null?: true
	/** Set by `ALTER COLUMN … DROP NOT NULL`. */
	nullable?: true
}

export type JsqlForeignKeyRef = {
	from: string
	columnPairs: JsqlFkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type JsqlFkColumnPair = [local: string, referenced: string]

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
