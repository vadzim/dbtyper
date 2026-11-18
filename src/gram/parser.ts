import type { Shifts, Reductions, Gotos, Rules } from "./gram.ts"

export type Parse<Engine, T extends Tokens> = DoParse<Engine, T, [0], []>

type Tokens = [string, string][]

type Head<T extends unknown[], Default = never> = T extends [infer Head, ...unknown[]] ? Head : Default
type Tail<T extends Tokens, Default = never> = T extends [unknown, ...infer Tokens] ? Tokens : Default

export type I<A, N> =
	A extends Record<string | number, unknown>
		? N extends string | number
			? A[N] extends infer R
				? unknown extends R
					? null
					: R
				: null
			: null
		: null

type Q<A, B> = A extends null ? B : A

type PeekToken<T extends Tokens> = Head<T, ["$end", ""]>
type SkipToken<T extends Tokens> = Tail<T, []>

type Call<Engine, LHS extends string, RHS extends unknown[]> = [LHS & keyof Engine] extends [never]
	? null
	: (Engine & { args: RHS })[LHS & keyof Engine]

type InternalError<S> = { internalError: S }

type PopData<Stack extends unknown[], Values extends unknown[], Args extends unknown, Acc extends unknown[] = []> = [
	Stack,
	Values,
	Args,
] extends [[unknown, ...infer StackRest], [infer Head, ...infer ValuesRest], [unknown, ...infer ArgsRest]]
	? PopData<StackRest, ValuesRest, ArgsRest, [Head, ...Acc]>
	: [Stack, Values, Acc]

type DoParse<Engine, T extends Tokens, Stack extends number[], Values extends unknown[]> =
	Head<Stack> extends infer H
		? I<I<Shifts, H>, PeekToken<T>[0]> extends infer S
			? S extends number
				? DoParse<Engine, SkipToken<T>, [S, ...Stack], [PeekToken<T>, ...Values]>
				: Q<I<I<Reductions, H>, PeekToken<T>[0]>, I<I<Reductions, H>, "$default">> extends infer RuleIndex
					? RuleIndex extends "accept"
						? Values[1]
						: I<Rules, RuleIndex> extends infer R
							? R extends { item: infer Item extends string; args: infer Args extends unknown[] }
								? PopData<Stack, Values, Args> extends [
										infer NewStack extends number[],
										infer NewValues extends unknown[],
										infer Data extends unknown[],
									]
									? Call<Engine, Item, Data> extends infer Result
										? Result extends null
											? InternalError<`not implemented: ${Item}/${Data["length"]}`>
											: I<I<Gotos, Head<NewStack>>, Item> extends infer G extends number
												? DoParse<Engine, T, [G, ...NewStack], [Result, ...NewValues]>
												: Result
										: "never5"
									: "never4"
								: InternalError<"no rule found">
							: "never3"
					: "never4"
			: "never2"
		: "never1"
