/** Type helpers for resolving unqualified column names across a join scope (Postgres-like). */

/**
 * Union of scope keys that expose `Col`.
 * Built as a mapped type + indexed access so each alias is checked independently.
 */
export type ScopeKeysWithColumn<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
> = {
	[K in keyof Scope]: Col extends keyof Scope[K]["columns"] ? K : never
}[keyof Scope]

type UnionToIntersection<U> = (U extends unknown ? (x: U) => unknown : never) extends (x: infer I) => unknown
	? I
	: never

/** True when `U` is a union (two or more distinct instantiations), not a single type. */
type IsUnion<U> = [U] extends [UnionToIntersection<U>] ? false : true

type HasAmbiguousUnqualifiedColumnRaw<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
> =
	ScopeKeysWithColumn<Scope, Col> extends infer K
		? [K] extends [never]
			? false
			: true extends IsUnion<K>
				? true
				: false
		: false

/**
 * True when two distinct scope keys both expose `Col` (ambiguous bare reference).
 * Collapses `true | false | boolean` from `HasAmbiguousUnqualifiedColumnRaw` to literal `true` / `false`.
 */
export type HasAmbiguousUnqualifiedColumn<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
> = true extends HasAmbiguousUnqualifiedColumnRaw<Scope, Col> ? true : false
