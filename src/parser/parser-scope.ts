import type { JsqlTableShape } from "../../core/jsql-shapes.ts"

/** One FROM/JOIN alias bound to a concrete table shape (columns + SQL types). */
export type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlTableShape["columns"]
	column_sql_types: Record<string, string>
}

/** Map alias → scope entry (one lexical layer: merge scopes as parsing descends). */
export type ScopeMap = { readonly [alias: string]: ScopeEntry }

export type MergeScope<A extends ScopeMap, B extends ScopeMap> = A & B

export type ValidateCol<Scope extends ScopeMap, Alias extends string, Col extends string> = Alias extends keyof Scope
	? Col extends keyof Scope[Alias]["columns"]
		? true
		: false
	: false
