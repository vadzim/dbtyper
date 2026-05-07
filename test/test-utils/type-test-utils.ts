/** Type-level test helpers for compile-time assertions. */

export type Expect<T extends true> = T

/**
 * Strict equality for type tests.
 * Deliberately returns `false` if either side contains `any` to avoid false-positive assertions.
 * The second parameter is the expected type, it always should be inlined in tests, except SqlParserError type. It is allowed to use SqlParserError as opaque type. The first parameter should be the actual type.
 */
export type Matches<Actual, Expected> =
	HasNeverDeep<Actual> extends true
		? false
		: HasNeverDeep<Expected> extends true
			? false
			: Actual extends Expected
				? Expected extends Actual
					? true
					: false
				: false

export type Extends<Actual, Expected> =
	HasNeverDeep<Actual> extends true
		? false
		: HasNeverDeep<Expected> extends true
			? false
			: Actual extends Expected
				? true
				: false

/**
 * Type testing utilities for compile-time assertions.
 * Use direct tuple indexing [1] or [2] for ParseSqlStatement / ParseWhereExpression results.
 */

/** `unknown` must not count as `any` (`[0] extends [1 & unknown]` is wrongly true). */
type IsAny<T> = 0 extends 1 & T ? (1 extends 0 & T ? true : false) : false
type IsNeverOrAny<T> = [T] extends [never] ? true : IsAny<T>

type HasNeverDeep<T> =
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
					: true extends {
								[K in keyof T]-?: IsNeverOrAny<T[K]> extends true ? true : HasNeverDeep<T[K]>
						  }[keyof T]
						? true
						: false
