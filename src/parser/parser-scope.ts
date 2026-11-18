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

/** Scope entry of an enclosing query level; `outerDepth` is a tuple whose length is the nesting distance. */
type ScopeEntryOuterDepth<E> = E extends { outerDepth: infer D extends readonly 1[] } ? D : readonly []

/**
 * Mark every entry of `Outer` as belonging to one level further out (SEL-24), so unqualified column
 * lookup prefers the innermost level that has the column. Qualified lookups are unaffected.
 */
export type MarkOuterScope<Outer extends ScopeMap> = {
	[K in keyof Outer]: {
		schema: Outer[K]["schema"]
		table: Outer[K]["table"]
		columns: Outer[K]["columns"]
		outerDepth: readonly [...ScopeEntryOuterDepth<Outer[K]>, 1]
	}
}

/** Drop scope entries that are CTE definitions (not FROM items): they are visible by name only. */
export type FromItemsOnly<Scope extends ScopeMap> = {
	[K in keyof Scope as Scope[K]["schema"] extends "__cte__" ? never : K]: Scope[K]
}
