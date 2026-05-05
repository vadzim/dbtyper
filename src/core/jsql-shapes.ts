export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: { [K: string]: JsqlSchemaShape }
	/** Typed SQL function names → SQL return type strings (e.g., "integer", "text"). Keys as used in SQL after identifier normalization, typically lowercase. */
	functions?: Record<string, string>
}

export type JsqlSchemaShape = {
	/** Named relations in the schema (base tables and views). */
	sets: { [K: string]: JsqlTableShape }
}

export type JsqlTableShape = {
	kind: "table" | "view"
	/** SQL type strings per column (e.g., "text", "integer", "uuid"). */
	columns: { [K: string]: string }
	constraints?: JsqlConstraintMap
	column_facts?: JsqlColumnFactsMap
}

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = {
	kind: "select"
	/** SQL type strings per column (e.g., "text", "integer", "uuid"). */
	columns: { [K: string]: string }
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

export type JsqlConstraintMap = { [K: string]: JsqlConstraintEntry }

export type JsqlColumnFactsEntry = {
	default?: true
	check?: true
	generated?: true | { mode: "stored" | "virtual" }
	/** Set by `ALTER COLUMN … SET NOT NULL` (type-level migration tracking). */
	not_null?: true
	/** Set by `ALTER COLUMN … DROP NOT NULL`. */
	nullable?: true
}

export type JsqlColumnFactsMap = { [K: string]: JsqlColumnFactsEntry }

export type JsqlForeignKeyRef = {
	from: string
	columnPairs: JsqlFkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type JsqlFkColumnPair = [local: string, referenced: string]
