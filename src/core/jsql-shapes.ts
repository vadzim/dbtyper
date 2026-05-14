import type { SqlTypeShape } from "./sql-type-shape.ts"

export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: unknown
	/** Typed SQL function names → SQL return type strings (e.g., "integer", "text"). Keys as used in SQL after identifier normalization, typically lowercase. */
	functions?: unknown
}

export type JsqlSchemaShape = {
	/** Named relations in the schema (base tables and views). */
	sets: unknown
	/** Named types in the schema (enums, etc.). */
	types?: unknown
}

export type JsqlTypeShape = {
	kind: "enum"
	/** Enum values in order. */
	values: readonly string[]
}

export type JsqlDataShape<Kind extends "table" | "view" = "table" | "view"> = {
	kind: Kind
	/** SQL types per column as SqlTypeShape objects. */
	columns: Record<string, SqlTypeShape>
	column_facts?: unknown
	constraints?: unknown
}

export type JsqlConstraintEntry =
	| { kind: "primary_key"; columns: string[] }
	| { kind: "unique"; columns: string[] }
	| { kind: "foreign_key"; refs: JsqlForeignKeyRef }

export type JsqlColumnFactsEntry = {
	default?: true
	check?: true
	generated?: true | { mode: "stored" | "virtual" }
	nullability?: "not_null" | "nullable"
}

export type JsqlForeignKeyRef = {
	from: string
	columnPairs: JsqlFkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type JsqlFkColumnPair = [local: string, referenced: string]

export type JsqlReturningResult = {
	returning: Record<string, SqlTypeShape> | null
}

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = JsqlReturningResult & {
	kind: "select"
	returning: Record<string, SqlTypeShape>
}

/** Type-level result of a parsed `INSERT` (DB state unchanged in this model). */
export type JsqlInsertStatementResult = JsqlReturningResult & {
	kind: "insert"
	table: string
	schema: string
	columns: readonly string[]
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
