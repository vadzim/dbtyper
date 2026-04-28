export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: { [K: string]: JsqlSchemaShape }
}

/** Type-level result of a parsed `SELECT` (DB state unchanged). */
export type JsqlSelectStatementResult = {
	kind: "select"
	columns: { [K: string]: unknown }
	column_sql_types: { [K: string]: string }
}

export type JsqlSchemaShape = {
	/** Named relations in the schema (base tables and views). */
	sets: { [K: string]: JsqlTableShape }
}

export type JsqlTableShape = {
	kind: "table" | "view"
	columns: { [K: string]: unknown }
	/** Original SQL type strings per column (normalized spacing, lowercased) for validation. */
	column_sql_types?: { [K: string]: string }
	constraints?: JsqlConstraintMap
	column_facts?: JsqlColumnFactsMap
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
