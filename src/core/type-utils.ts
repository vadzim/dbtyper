type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

type Repeat<X, N extends number, Acc extends unknown[] = []> = Acc["length"] extends N ? Acc : Repeat<X, N, [...Acc, X]>

type Numbers = Counting<200>

export type Inc = Numbers extends [0, ...infer Rest] ? [...Rest, number] : never
export type Dec = [never, ...Numbers]

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

export type LT = Diag<Repeat<false, NN>, Repeat<true, NN>>
export type LTE = [Repeat<true, NN>, ...LT]
export type GT = Diag<Repeat<true, NN>, Repeat<false, NN>>
export type GTE = [Repeat<false, NN>, ...GT]

export type HasKey<T, K extends string> = K extends keyof T ? true : false

export type I<T, K extends string | number, R = {}> = K extends keyof T ? T[K] & R : R

export type ReplaceProp<T, K extends string | symbol, V> = Omit<T, K> & Record<K, V> extends infer R
	? { [K in keyof R]: R[K] }
	: never

export type ReplaceProps<T, Props> = Omit<T, keyof Props> & Props extends infer R ? { [K in keyof R]: R[K] } : never

export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

export type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never

type TupleSize = Counting<21>[number]

export type Tuple<T, N extends TupleSize> = N extends 0 ? [] : [T, ...Tuple<T, Dec[N]>]

export type ExpectTrue<T extends true> = T

export type IsNotAny<T> = 0 extends 1 & T ? (1 extends 0 & T ? false : true) : true

export type IsNotNever<T> = [T] extends [never] ? false : true

export type IsNotAnyOrNever<T> = [IsNotNever<T>, IsNotAny<T>] extends [true, true] ? true : false
