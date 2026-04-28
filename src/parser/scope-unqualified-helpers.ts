/** Type helpers for resolving unqualified column names across a join scope (Postgres-like). */

export type ScopeKeysWithColumn<
	Scope extends { readonly [key: string]: { columns: Record<string, unknown> } },
	Col extends string,
> = keyof Scope extends infer K
	? K extends keyof Scope
		? Col extends keyof Scope[K]["columns"]
			? K
			: never
		: never
	: never

/** True when two distinct scope keys both expose `Col` (ambiguous bare reference). */
export type HasAmbiguousUnqualifiedColumn<
	Scope extends { readonly [key: string]: { columns: Record<string, unknown> } },
	Col extends string,
> = keyof Scope extends infer K1
	? K1 extends keyof Scope
		? Col extends keyof Scope[K1]["columns"]
			? keyof Scope extends infer K2
				? K2 extends keyof Scope
					? K2 extends K1
						? never
						: Col extends keyof Scope[K2]["columns"]
							? true
							: never
					: never
				: never
			: never
		: never
	: never
