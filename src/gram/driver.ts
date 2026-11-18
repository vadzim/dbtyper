/**
 * Shared type-level LR driver of the per-dialect grammars (track B, #52 / #93).
 * Shape: DECISIONS.md, "Track B: dialect selection shape (#52)". Tables come from `npm run gram:generate`
 * (src/gram/README.md); this file knows nothing about a dialect.
 *
 * `Recognize` runs the LALR(1) automaton over terminal names and answers accept or "rejected at token i".
 * There are no semantic actions (typing is a separate concern); the value stack is not kept, only states.
 * Performance work is #95; known limit: very long statements hit TS2589.
 */

/** The four table types a dialect's `tables.ts` exports (as `Tables`). */
export type GramTables = { Shifts: unknown; Reductions: unknown; Gotos: unknown; Rules: unknown }

export type RecognizeResult = { ok: true } | { ok: false; at: number; token: string }

/** `Tokens` are bison terminal names without the final `$end` (it is implied). `at` is the index into `Tokens` (`Tokens["length"]` = unexpected end). */
export type Recognize<Tables extends GramTables, Tokens extends readonly string[]> = Run<Tables, Tokens, [0], []>

type Lookup<A, N> =
	A extends Record<string | number, unknown>
		? N extends string | number
			? A[N] extends infer R
				? unknown extends R
					? null
					: R
				: null
			: null
		: null

type PreferNotNull<A, B> = A extends null ? B : A

type Peek<T extends readonly string[]> = T extends readonly [infer H extends string, ...unknown[]] ? H : "$end"

type Pop<Stack extends number[], Args extends unknown[]> = Args extends [unknown, ...infer Rest]
	? Stack extends [unknown, ...infer StackRest extends number[]]
		? Pop<StackRest, Rest>
		: never
	: Stack

type Run<
	T extends GramTables,
	Rest extends readonly string[],
	Stack extends number[],
	Seen extends unknown[],
> = Stack extends [infer State extends number, ...number[]]
	? Peek<Rest> extends infer Tok extends string
		? Lookup<Lookup<T["Shifts"], State>, Tok> extends infer Next
			? Next extends number
				? Run<
						T,
						Rest extends readonly [unknown, ...infer Tail extends readonly string[]] ? Tail : Rest,
						[Next, ...Stack],
						Rest extends readonly [] ? Seen : [...Seen, 0]
					>
				: PreferNotNull<
							Lookup<Lookup<T["Reductions"], State>, Tok>,
							Lookup<Lookup<T["Reductions"], State>, "$default">
					  > extends infer RuleIndex
					? RuleIndex extends "accept"
						? { ok: true }
						: Lookup<T["Rules"], RuleIndex> extends {
									item: infer Item extends string
									args: infer Args extends unknown[]
							  }
							? Pop<Stack, Args> extends infer Popped extends number[]
								? Lookup<Lookup<T["Gotos"], Popped[0]>, Item> extends infer G extends number
									? Run<T, Rest, [G, ...Popped], Seen>
									: never
								: never
							: { ok: false; at: Seen["length"]; token: Tok }
					: never
			: never
		: never
	: never
