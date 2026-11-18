type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

type Repeat<X, N extends number, Acc extends unknown[] = []> = Acc["length"] extends N ? Acc : Repeat<X, N, [...Acc, X]>

type Numbers = Counting<200>

type IncData = Numbers extends [0, ...infer Rest] ? [...Rest, number] : never
type DecData = [never, ...Numbers]

export type Inc<N extends number> = IncData[N]
export type Dec<N extends number> = DecData[N]

type Diag<
	Left extends unknown[] = [],
	Right extends unknown[] = [],
	Acc extends unknown[][] = [],
	LeftStart extends unknown[] = [],
> = Right extends [infer _H, ...infer RightTail]
	? Left extends [infer Elem, ...infer LeftTail]
		? Diag<LeftTail, RightTail, [...Acc, [...LeftStart, Elem, ...RightTail]], [...LeftStart, Elem]>
		: Acc
	: Acc

type NN = 100

type LTData = Diag<Repeat<false, NN>, Repeat<true, NN>>
type LTEData = [Repeat<true, NN>, ...LTData]
type GTData = Diag<Repeat<true, NN>, Repeat<false, NN>>
type GTEData = [Repeat<false, NN>, ...GTData]

export type LT<A extends number, B extends number> = LTData[A][B]
export type LTE<A extends number, B extends number> = LTEData[A][B]
export type GT<A extends number, B extends number> = GTData[A][B]
export type GTE<A extends number, B extends number> = GTEData[A][B]

export type HasKey<T, K extends string> = K extends keyof T ? true : false

export type I<T, K extends string | number, R = {}> = K extends keyof T ? T[K] & R : R

export type ReplaceProp<T, K extends string | symbol, V> = Omit<T, K> & Record<K, V> extends infer R
	? ForceProps<{ [K in keyof R]: R[K] }>
	: never

/**
 * Resolves every property type of a mapped type right away (inferring from all properties does it).
 * Without it each ReplaceProp layer keeps pointing at the previous one, and reading a property
 * after ~50 chained updates (STMT-16: 60 statements in one migration) exceeds the instantiation depth.
 */
type ForceProps<F> = F extends Record<keyof F, infer _V> ? F : F

export type ReplaceProps<T, Props> = Omit<T, keyof Props> & Props extends infer R ? { [K in keyof R]: R[K] } : never

export type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void
	? I
	: never

export type LastOf<T> = UnionToIntersection<T extends unknown ? () => T : never> extends () => infer R ? R : never

export type TupleSize = Counting<21>[number]

export type Tuple<T, N extends TupleSize> = N extends 0 ? [] : [T, ...Tuple<T, Dec<N>>]

export type ExpectTrue<T extends true> = T

export type IsNotAny<T> = 0 extends 1 & T ? (1 extends 0 & T ? false : true) : true

export type IsNotNever<T> = [T] extends [never] ? false : true

export type IsNotUnknown<T> = [unknown] extends [T] ? false : true

export type IsNotAnyOrNever<T> = [IsNotNever<T>, IsNotAny<T>] extends [true, true] ? true : false

export type IsNotAnyOrNeverOrUnknown<T> = [IsNotNever<T>, IsNotAny<T>, IsNotUnknown<T>] extends [true, true, true]
	? true
	: false

export type BoolAnd<B1 extends boolean, B2 extends boolean> = B1 extends true ? B2 : false
export type BoolOr<B1 extends boolean, B2 extends boolean> = B1 extends false ? B2 : true
export type BoolNot<B extends boolean> = B extends true ? false : true
export type BoolXor<B1 extends boolean, B2 extends boolean> = B1 extends false ? B2 : B2 extends false ? true : false

export type ParseNumber<S extends string> = S extends `${infer Number extends number}` ? Number : never
