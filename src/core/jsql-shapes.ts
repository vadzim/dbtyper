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
	/** SQL type strings per column (e.g., "text", "integer", "uuid"). */
	columns: Record<string, string>
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

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = {
	kind: "select"
	columns: Record<string, string>
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
