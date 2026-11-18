type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

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

export type TupleSize = Counting<21>[number]

export type Tuple<T, N extends TupleSize> = N extends 0 ? [] : [T, ...Tuple<T, Dec<N>>]

export type ParseNumber<S extends string> = S extends `${infer Number extends number}` ? Number : never

/** Record merge where keys of `B` win; lazy, so wrap it in `ForceProps` when it is chained (#48). */
export type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}
