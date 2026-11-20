/**
 * `a + b + c …`, `a * b * c …` and `a || b || c …` (#174): the operands of one run of the same operator are
 * collected tail-recursively, then folded into a tree whose depth stays small, as AND / OR chains are (#105,
 * parse-expression-bool.ts). A left-nested tree of n operators is n levels deep, and every walk over it (`extends
 * ScalarExprAst`, the resolver) nests one level per operator: TS2589 / TS2321 at about 27 operators.
 *
 * Unlike AND / OR these operators are not associative for every type (`date + 1 + 1`, a `$1` that takes its type from
 * its neighbour), so the first {@link ChainChunk} operands of a run are folded to the left, exactly as before, and
 * only the chunks of a longer run are balanced against each other. Short chains therefore give the same AST as ever.
 * Do not fold the whole run to the left again, and do not grow one accumulator tuple (quadratic, see #105).
 * `-`, `%` and custom operators end a run: they are not associative and stay left-nested.
 */
export type ChainChunk = 8

export type ChainKind = "add" | "mul" | "concat"

type ChainNode<K extends ChainKind, L, R> = K extends "add"
	? { kind: "add"; left: L; right: R }
	: K extends "mul"
		? { kind: "mul"; left: L; right: R }
		: { kind: "custom_op"; op: "||"; left: L; right: R }

/** `[a, b, c]` becomes `(a ⊕ b) ⊕ c`. */
type FoldChainLeft<K extends ChainKind, Items extends readonly unknown[]> = Items extends readonly [infer A, ...infer T]
	? FoldChainLeftFrom<K, A, T>
	: never

type FoldChainLeftFrom<K extends ChainKind, Acc, T extends readonly unknown[]> = T extends readonly [
	infer B,
	...infer R,
]
	? FoldChainLeftFrom<K, ChainNode<K, Acc, B>, R>
	: Acc

type BalanceChain<K extends ChainKind, Items extends readonly unknown[]> = Items extends readonly [infer Only]
	? Only
	: BalanceChain<K, PairChain<K, Items>>

type PairChain<
	K extends ChainKind,
	Items extends readonly unknown[],
	Out extends readonly unknown[] = [],
> = Items extends readonly [infer A, infer B, ...infer T]
	? PairChain<K, T, [...Out, ChainNode<K, A, B>]>
	: [...Out, ...Items]

/** Adds one operand to the current chunk; a full chunk is folded into one node of `Done` first. */
export type PushChainOperand<
	K extends ChainKind,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
	E,
> = Items["length"] extends ChainChunk ? [[E], [...Done, FoldChainLeft<K, Items>]] : [[...Items, E], Done]

export type FinishChain<
	K extends ChainKind,
	Items extends readonly unknown[],
	Done extends readonly unknown[],
> = Done extends readonly [] ? FoldChainLeft<K, Items> : BalanceChain<K, [...Done, FoldChainLeft<K, Items>]>
