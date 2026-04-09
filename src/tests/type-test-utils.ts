/** Type-level test helpers for compile-time assertions. */

export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Strict equality for type tests.
 * Deliberately returns `false` if either side is `any` to avoid false-positive assertions.
 */
export type Equal<A, B> =
	IsAny<A> extends true
		? false
		: IsAny<B> extends true
			? false
			: (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
				? true
				: false

export type Expect<T extends true> = T
export type ExpectFalse<T extends false> = T
export type Matches<Actual, Expected> = Actual extends Expected ? true : false
