import type { JsqlDataShape } from "../core/jsql-shapes.ts"

/** One FROM/JOIN alias bound to a concrete table shape (columns as SQL type strings). */
export type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlDataShape["columns"]
}

/**
 * Map alias → scope entry (one lexical layer: merge scopes as parsing descends).
 * Use `Record<string, ScopeEntry>` (not a `readonly` index signature) so intersections like
 * `Record<"t1", E1> & Record<"t2", E2>` stay assignable and keep literal keys for `keyof`.
 */
export type ScopeMap = Record<string, ScopeEntry>

/**
 * Merge two scopes with proper shadowing: Inner scope shadows/hides Outer scope.
 * If both scopes have the same alias, Inner wins (standard lexical scoping).
 */
export type MergeScope<Inner extends ScopeMap, Outer extends ScopeMap> = Inner & Omit<Outer, keyof Inner>

export type ValidateCol<Scope extends ScopeMap, Alias extends string, Col extends string> = Alias extends keyof Scope
	? Col extends keyof Scope[Alias]["columns"]
		? true
		: false
	: false
