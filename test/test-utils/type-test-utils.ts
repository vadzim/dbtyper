/**
 * Type assertion utilities for use in .test.ts files.
 *
 * Design goal: when a type test fails, tsc prints the actual mismatched type
 * in the error message, not just "false is not assignable to true".
 * This makes failures immediately readable by both humans and LLMs.
 *
 * The pattern works by forcing TypeScript to unify two `<U>() => U extends X ? 1 : 2` shapes —
 * a mismatch surfaces X itself in the error, not a boolean sentinel.
 *
 * Invalid (any/never-containing) types are rejected before unification,
 * with a symbol-keyed message that appears verbatim in the tsc output.
 *
 * Community alternatives (tsd, expect-type) use `Expect<T extends true>`
 * which only tells you "false is not assignable to true" — useless for
 * diagnosing what the type actually was.
 */

// TODO: extract to a package

// Identity check (the same trick as the usual `Equal<A, B>`): unlike `(x: T) => T` it tells `any` from every other
// type at any depth, so `any[]`, `Promise<any>` or `{ a: any }` do not pass for a concrete type. The function type is
// written inline on purpose: wrapped into a generic alias, TypeScript compares two instances by the
// variance of the alias parameter and an `any` argument is then related to everything.

declare const invalidref: unique symbol

declare const invalidExpectType: unique symbol
type InvalidExpectType<T> = { [invalidExpectType]: "Invalid expect type: it contains never or any"; [invalidref]: T }

declare const invalidToBeType: unique symbol
type InvalidToBeType<T> = { [invalidToBeType]: "Invalid to-be type: it contains never or any"; [invalidref]: T }

export function expectType<X>(
	_x: HasNeverOrAnyDeep<X> extends true ? InvalidExpectType<X> : <U>() => U extends X ? 1 : 2,
) {}

export function toBe<X>(): HasNeverOrAnyDeep<X> extends true ? InvalidToBeType<X> : <U>() => U extends X ? 1 : 2 {
	return undefined as never
}

/** `unknown` must not count as `any` (`[0] extends [1 & unknown]` is wrongly true). */
type IsAny<T> = 0 extends 1 & T ? true : false
type IsNeverOrAny<T> = [T] extends [never] ? true : IsAny<T>

type HasNeverOrAnyDeep<T> =
	IsNeverOrAny<T> extends true
		? true
		: T extends (...args: never[]) => unknown
			? false
			: T extends readonly [infer H, ...infer R]
				? HasNeverOrAnyDeep<H> extends true
					? true
					: HasNeverOrAnyDeep<R>
				: T extends readonly (infer U)[]
					? IsNeverOrAny<U> extends true
						? false
						: HasNeverOrAnyDeep<U>
					: true extends {
								[K in keyof T]-?: IsNeverOrAny<T[K]> extends true ? true : HasNeverOrAnyDeep<T[K]>
						  }[keyof T]
						? true
						: false
