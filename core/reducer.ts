import type { Dec } from "./type-utils.ts"

interface TypeLambda {
	readonly input: unknown
	readonly output: unknown
}

type Apply<F extends TypeLambda, A> = (F & { readonly input: A })["output"]

interface ReducerLambda {
	readonly input: unknown // [acc0, acc1, options]
	readonly output: unknown // [newAcc0, newAcc1]
	readonly done: unknown // stop when acc0 extends this
}

type IterReduce<
	Acc0,
	Acc1,
	Options,
	F extends ReducerLambda,
	Done = F["done"], // inherits from F, but can be overridden at call site
	D extends number = 20,
> = [D] extends [0]
	? Acc1 // depth guard — return what we have
	: Acc0 extends Done
		? Acc1 // ✓ termination condition met
		: Apply<F, [Acc0, Acc1, Options]> extends [infer A0, infer A1]
			? IterReduce<A0, A1, Options, F, Done, Dec[D]>
			: never

interface BoundReducer<Options, F extends ReducerLambda, Done = F["done"]> extends TypeLambda {
	// input = [initialAcc0, initialAcc1]
	readonly output: this["input"] extends [infer Acc0, infer Acc1] ? IterReduce<Acc0, Acc1, Options, F, Done> : never
}
