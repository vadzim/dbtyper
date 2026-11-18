type UnionToIntersection<U> = (U extends unknown ? (x: U) => unknown : never) extends (x: infer I) => unknown
	? I
	: never

/** True when `U` is a union (two or more distinct instantiations), not a single type. */
type IsUnion<U> = [U] extends [UnionToIntersection<U>] ? false : true

/** Nesting depth of a scope entry: `0` for the current query level, `n` for an `n`-th enclosing level (SEL-24). */
type ScopeEntryDepth<E> = E extends { outerDepth: infer D extends readonly unknown[] } ? D["length"] : 0

/** CORE-9: a column merged away by USING / NATURAL is not visible to an unqualified reference. */
type HiddenColumns<E> = E extends { hidden: infer H extends string } ? H : never

type ScopeKeysWithColumnAtDepth<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
	Depth extends number,
> = {
	[K in keyof Scope]: Col extends keyof Scope[K]["columns"]
		? Col extends HiddenColumns<Scope[K]>
			? never
			: ScopeEntryDepth<Scope[K]> extends Depth
				? K
				: never
		: never
}[keyof Scope]

/**
 * SEL-24: scope keys exposing `Col` at the innermost query level that has it (`never` when no level has it).
 * Outer levels are only consulted when every inner level lacks the column.
 */
export type NearestScopeKeysWithColumn<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
	Counter extends readonly 1[] = readonly [],
> =
	ScopeKeysWithColumnAtDepth<Scope, Col, Counter["length"]> extends infer U
		? [U] extends [never]
			? Counter["length"] extends 8
				? never
				: NearestScopeKeysWithColumn<Scope, Col, readonly [...Counter, 1]>
			: U
		: never

/**
 * True when two distinct scope keys of the nearest level that has `Col` both expose it (ambiguous bare reference).
 */
export type HasAmbiguousUnqualifiedColumn<
	Scope extends Record<string, { columns: Record<string, unknown> }>,
	Col extends string,
> = NearestScopeKeysWithColumn<Scope, Col> extends infer K ? ([K] extends [never] ? false : IsUnion<K>) : false
