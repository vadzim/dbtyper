type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

/**
 * The numbers 0..199 as a tuple. Found by trial: `Inc`/`Dec` are table lookups (cheap), a longer tuple costs more on
 * every use and 200 is enough for the callers, which count statement batches (50) and positional parameters.
 * `Inc<199>` is `number` and `Inc<200>` is `undefined`: a caller that may pass a bigger number must check it. The
 * positional parameters of a statement use it (`?` numbers, the `$n` in messages): a statement with more than
 * `MaxPositionalParams` (199, measured: 199 works and 200 does not, both dialects) of them is TOO_MANY_PARAMETERS
 * (2407, #167), checked on the values before any parsing.
 */
// TLVL-4: bound 200 dodges TypeScript's tuple-length and instantiation-depth limits (see the paragraph above);
// found by trial, checked by test/stress/migration-60-statements, params-30-parameters and the 2500-statement test.
type Numbers = Counting<200>

/** The most positional parameters a statement may have (#167): the numbers `Numbers` can count to, 199. */
export type MaxPositionalParams = Dec<Numbers["length"]>

/** `true` when the count `N` is a literal over {@link MaxPositionalParams}; `false` for a smaller or an unknown count. */
export type OverParamLimit<N extends number> = number extends N ? false : N extends Numbers[number] ? false : true

type IncData = Numbers extends [0, ...infer Rest] ? [...Rest, number] : never
type DecData = [never, ...Numbers]

export type Inc<N extends number> = IncData[N]
export type Dec<N extends number> = DecData[N]

/** The object of a union of `[key, value]` pairs: it holds its pairs only, no object it was made from (#192). */
export type FromEntries<E extends readonly [PropertyKey, unknown]> = { [X in E as X[0]]: X[1] }

/**
 * `T` with the property `K` set to `V`. #192: the result is built from the `[key, value]` pairs of `T` (values
 * resolved), so it does not point at `T`. A mapped type over `T` (`Omit<T, K> & Record<K, V>`,
 * `{ [P in keyof T]: … }`) keeps `T` in its mapper, the next update keeps that one, and TypeScript walks the whole
 * chain of earlier states each time the schema is instantiated: the instantiation depth (limit 100, TS2589) grew
 * with every schema change of a migration chain. Two more things keep `T` alive in the same way, so both are avoided:
 * the alias arguments of a result that is itself an alias instantiation (hence the pairs are computed inline in the
 * `extends` check, not in an alias `EntriesOf<T>`, and the result is `FromEntries<pairs>`), and an object type
 * written inside a conditional type (it keeps every type parameter and every `infer` in scope).
 * Rule for the schema state: change it with `ReplaceProp` / `OmitProp` only, and build its objects with an alias
 * whose parameters are the parts of the object (`JsqlCreateTable`, `JsqlConstraints`, …).
 */
export type ReplaceProp<T, K extends string | symbol, V> = {
	[P in keyof T]-?: [P, T[P]]
}[keyof T] extends infer E extends readonly [PropertyKey, unknown]
	? FromEntries<Exclude<E, readonly [K, unknown]> | [K, V]>
	: never

/** `T` without the properties `K`; like {@link ReplaceProp} it does not point at `T` (use it instead of `Omit` on schema state). */
export type OmitProp<T, K extends string | symbol> = { [P in keyof T]-?: [P, T[P]] }[keyof T] extends infer E extends
	readonly [PropertyKey, unknown]
	? FromEntries<Exclude<E, readonly [K, unknown]>>
	: never

export type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
	? I
	: never

export type LastOf<T> = UnionToIntersection<T extends unknown ? () => T : never> extends () => infer R ? R : never

/**
 * TLVL-4: bound 21 = 0..20 error-message arguments (the largest `Tuple` that `ErrorArgs` builds, commit 12bd3d2).
 * Limit dodged: the recursion depth of the non-tail-recursive `Tuple` below. Measured (TS 7.0.2, 2026-11-19, probe
 * of `Tuple<string, N>` with a plain `number` parameter): N = 48 ok, N = 49 TS2589, so 21 has a margin of 27. A
 * bigger bound would only need `Numbers` (200) to stay larger; `Counting<N>` itself hits TS2589 at N = 1000 (999 ok).
 * Finding test: `FormatError` of every error in dbtyper-error.ts (a message of 21 or more parts would not typecheck).
 */
export type TupleSize = Counting<21>[number]

export type Tuple<T, N extends TupleSize> = N extends 0 ? [] : [T, ...Tuple<T, Dec<N>>]

export type ParseNumber<S extends string> = S extends `${infer Number extends number}` ? Number : never

/**
 * Record merge where keys of `B` win. Lazy, and it points at `A` and `B`: not for chained updates of the schema state
 * (use {@link ReplaceProp}, #192).
 */
export type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}
