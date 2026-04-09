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

type IsNeverOrAny<T> = [T] extends [never] ? true : IsAny<T>

export type HasNeverDeep<T> =
	IsNeverOrAny<T> extends true
		? true
		: T extends (...args: never[]) => unknown
			? false
			: T extends readonly [infer H, ...infer R]
				? HasNeverDeep<H> extends true
					? true
					: HasNeverDeep<R>
				: T extends readonly (infer U)[]
					? IsNeverOrAny<U> extends true
						? false
						: HasNeverDeep<U>
					: T extends object
						? true extends {
								[K in keyof T]-?: IsNeverOrAny<T[K]> extends true ? true : HasNeverDeep<T[K]>
							}[keyof T]
							? true
							: false
						: false

export type Matches<Actual, Expected> =
	HasNeverDeep<Actual> extends true
		? false
		: HasNeverDeep<Expected> extends true
			? false
			: Actual extends Expected
				? true
				: false
