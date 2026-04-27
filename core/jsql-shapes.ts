export type JsqlDatabaseShape = {
	defaultSchema: string
	schemas: { [K: string]: JsqlSchemaShape }
}

export type JsqlSchemaShape = {
	tables: { [K: string]: JsqlTableShape }
}

export type JsqlTableShape = {
	columns: { [K: string]: unknown }
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
}

export type JsqlColumnFactsMap = { [K: string]: JsqlColumnFactsEntry }

export type JsqlForeignKeyRef = {
	from: string
	columnPairs: JsqlFkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type JsqlFkColumnPair = [local: string, referenced: string]
