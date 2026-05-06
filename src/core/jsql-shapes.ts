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

export type JsqlTableShape = {
	kind: "table" | "view"
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
