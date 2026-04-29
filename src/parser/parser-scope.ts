import type { JsqlTableShape } from "../core/jsql-shapes.ts"

/** One FROM/JOIN alias bound to a concrete table shape (columns + SQL types). */
export type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlTableShape["columns"]
	column_sql_types: Record<string, string>
}

/**
 * Map alias → scope entry (one lexical layer: merge scopes as parsing descends).
 * Use `Record<string, ScopeEntry>` (not a `readonly` index signature) so intersections like
 * `Record<"t1", E1> & Record<"t2", E2>` stay assignable and keep literal keys for `keyof`.
 */
export type ScopeMap = Record<string, ScopeEntry>

export type MergeScope<A extends ScopeMap, B extends ScopeMap> = A & B

export type ValidateCol<Scope extends ScopeMap, Alias extends string, Col extends string> = Alias extends keyof Scope
	? Col extends keyof Scope[Alias]["columns"]
		? true
		: false
	: false
