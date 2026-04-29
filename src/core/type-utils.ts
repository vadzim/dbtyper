type Counting<N extends number, Acc extends unknown[] = []> = Acc["length"] extends N
	? Acc
	: Counting<N, [...Acc, Acc["length"]]>

type Numbers = Counting<100>

export type Inc = Numbers extends [0, ...infer Rest] ? [...Rest, number] : never
export type Dec = [never, ...Numbers]
