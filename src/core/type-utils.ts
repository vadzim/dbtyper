type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

type Repeat<X, N extends number, Acc extends unknown[] = []> = Acc["length"] extends N ? Acc : Repeat<X, N, [...Acc, X]>

type Numbers = Counting<100>

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

type NN = 20

export type LT = Diag<Repeat<false, NN>, Repeat<true, NN>>
export type LTE = [Repeat<true, NN>, ...LT]
export type GT = Diag<Repeat<true, NN>, Repeat<false, NN>>
export type GTE = [Repeat<false, NN>, ...GT]
