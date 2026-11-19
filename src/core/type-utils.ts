type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

/**
 * The numbers 0..199 as a tuple. Found by trial: `Inc`/`Dec` are table lookups (cheap), a longer tuple costs more on
 * every use and 200 is enough for the callers, which count statement batches (50) and positional parameters.
 * `Inc<200>` is `undefined`: a caller that may pass a bigger number must check it (param-probe.ts shows `$n` with
 * it, so a statement with 200 or more positional parameters shows no number there).
 */
// TLVL-4: bound 200 dodges TypeScript's tuple-length and instantiation-depth limits (see the paragraph above);
// found by trial, checked by test/stress/migration-60-statements, params-30-parameters and the 2500-statement test.
type Numbers = Counting<200>

type IncData = Numbers extends [0, ...infer Rest] ? [...Rest, number] : never
type DecData = [never, ...Numbers]

export type Inc<N extends number> = IncData[N]
export type Dec<N extends number> = DecData[N]

export type ReplaceProp<T, K extends string | symbol, V> = Omit<T, K> & Record<K, V> extends infer R
	? ForceProps<{ [K in keyof R]: R[K] }>
	: never

/**
 * Resolves every property type of a mapped type right away (inferring from all properties does it).
 * Without it each ReplaceProp layer keeps pointing at the previous one, and reading a property
 * after ~50 chained updates (STMT-16: 60 statements in one migration) exceeds the instantiation depth.
 */
export type ForceProps<F> = F extends Record<keyof F, infer _V> ? F : F

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

/** Record merge where keys of `B` win; lazy, so wrap it in `ForceProps` when it is chained (#48). */
export type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}
