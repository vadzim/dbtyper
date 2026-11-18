/**
 * Shared type-level LR driver of the per-dialect grammars (track B, #52 / #93 / #95).
 * Shape: DECISIONS.md, "Track B: dialect selection shape (#52)" and "LR driver performance (#95)". Tables come from
 * `npm run gram:generate` (src/gram/README.md); this file knows nothing about a dialect.
 *
 * `Recognize` runs the LALR(1) automaton over terminal names and answers accept or "rejected at token i".
 * There are no semantic actions (typing is a separate concern); only the stack of states is kept.
 *
 * Why it is shaped this way (numbers: DECISIONS.md, `npm run gram:bench`):
 * - A conditional type that calls itself in tail position is a loop, but TypeScript stops it after 1000 iterations
 *   (TS2589). One iteration per automaton step would cap statements at a few hundred tokens, so the loop is two-level:
 *   `Chunk` runs up to `Fuel` steps as a tail-recursive loop, `Run` (also tail-recursive) restarts it.
 * - `Actions` and `Gotos` are looked up with `keyof` probes in flat, interface-based rows, not through intersections.
 * - A run of unit reductions that does not depend on the lookahead is one step (`chain` in `xml2ts.ts`).
 */

import type { ChunkSteps, Dec, Inc } from "./counters.d.ts"

/** The table types a dialect's `tables.d.ts` exports (as `Tables`). `Fallback` is optional: see `Recognize`. */
export type GramTables = { Actions: unknown; Gotos: unknown; Fallback?: unknown }

export type RecognizeResult = { ok: true } | { ok: false; at: number; token: string }

/**
 * `Tokens` are bison terminal names without the final `$end` (it is implied). `at` is the index into `Tokens`
 * (`Tokens["length"]` = unexpected end). More tokens than `MaxTokens` (src/gram/counters.ts) answers `token: "$too-long"`.
 *
 * `Tables["Fallback"]` (optional, for lemon grammars: `%fallback ID ...`) maps a terminal to the terminal to try when the
 * state has no explicit action for the first one (before the default reduction).
 */
export type Recognize<Tables extends GramTables, Tokens extends readonly string[]> = Run<
	Tables["Actions"],
	Tables["Gotos"],
	Tables extends { Fallback: infer F } ? F : {},
	Tokens,
	0,
	[0]
>

type Peek<All extends readonly string[], Index extends number> = All[Index] extends infer T extends string ? T : "$end"

/**
 * Table lookups are `Table extends Record<Key, infer Value>` (an O(1) property probe), never `Key extends keyof Table`:
 * `keyof` of a big object type builds a union of all its keys again at every use (tsc: milliseconds per step).
 */
type Run<A, G, F, All extends readonly string[], Index extends number, Stack extends number[]> =
	Chunk<A, G, F, All, Index, Peek<All, Index>, Stack, ChunkSteps> extends infer C
		? C extends { index: infer I extends number; stack: infer S extends number[] }
			? Run<A, G, F, All, I, S>
			: C
		: never

/**
 * One chunk: up to `Fuel` automaton steps. `Tok` is the lookahead (recomputed on shift only). A step is a shift, a
 * reduction (pop, goto) or a collapsed run of unit reductions. Returns a result, or `{ index, stack }` to be resumed.
 */
type Chunk<
	A,
	G,
	F,
	All extends readonly string[],
	Index extends number,
	Tok extends string,
	Stack extends number[],
	Fuel extends number,
> = Fuel extends 0
	? { index: Index; stack: Stack }
	: Stack extends [infer State extends number, ...unknown[]]
		? A extends Record<State, infer Row>
			? (
					Row extends Record<Tok, infer Explicit>
						? Explicit
						: Tok extends keyof F
							? Row extends Record<F[Tok] & string, infer Fallback>
								? Fallback
								: Default<Row>
							: Default<Row>
				) extends infer Action
				? Action extends number
					? Inc extends Record<Index, infer Next extends number>
						? Chunk<A, G, F, All, Next, Peek<All, Next>, [Action, ...Stack], Step<Fuel>>
						: { ok: false; at: Index; token: "$too-long" }
					: Action extends [infer Pops extends unknown[], infer Item extends string, ...unknown[]]
						? Stack extends [...Pops, ...infer Popped extends number[]]
							? Popped extends [infer Top extends number, ...unknown[]]
								? G extends Record<Top, Record<Item, infer Next extends number>>
									? Chunk<A, G, F, All, Index, Tok, [Next, ...Popped], Step<Fuel>>
									: never
								: never
							: never
						: Action extends "accept"
							? { ok: true }
							: Action extends null
								? { ok: false; at: Index; token: Tok }
								: // a collapsed run of unit reductions: { stateBelow: stateToReplaceTheTopWith }
									Stack extends [
											unknown,
											infer Below extends number,
											...infer Deeper extends number[],
									  ]
									? Action extends Record<Below, infer Top extends number>
										? Chunk<A, G, F, All, Index, Tok, [Top, Below, ...Deeper], Step<Fuel>>
										: never
									: never
				: never
			: { ok: false; at: Index; token: Tok }
		: never

/** What the other terminals do in a state: its `$default` action, or null (error). */
type Default<Row> = Row extends { $default: infer D } ? D : null

/** Fuel left after one more step. */
type Step<Fuel extends number> = Dec extends Record<Fuel, infer Left extends number> ? Left : never

/**
 * A semantic action (track B typing, #55): a type-level function of the values of a rule's right-hand side, written as
 * an interface that reads `this["a"]` (higher-kinded type through `this`). `a` is the value stack, top first: for
 * `expr: expr PLUS expr`, `a[0]` is the right `expr`, `a[1]` the PLUS token, `a[2]` the left `expr`; `r` is the value
 * of the left-hand side.
 */
export interface SemanticAction {
	a: unknown[]
	r: unknown
}

type CallAction<Act extends SemanticAction, Values extends unknown[]> = (Act & { a: Values })["r"]

/**
 * `Recognize` plus a value stack (track B typing, #55): a shifted terminal pushes `[terminal, Texts[i]]`; a reduction
 * by a rule whose key (`"lhs: RHS"`, the third element of a reduce action, emitted when the dialect has an
 * `actions.ts`) is in `RuleActions` pushes that action's result; any other rule pushes its only value (a one-symbol rule)
 * or its key (a marker: "this rule has no action", which the typer reads as not supported). A collapsed unit chain
 * keeps the value (xml2ts.ts does not collapse unit rules that have an action). On accept, `value` is the value of the
 * start symbol.
 */
export type Parse<
	Tables extends GramTables,
	Tokens extends readonly string[],
	Texts extends readonly unknown[],
	RuleActions,
> = PRun<
	Tables["Actions"],
	Tables["Gotos"],
	Tables extends { Fallback: infer F } ? F : {},
	RuleActions,
	Tokens,
	Texts,
	0,
	[0],
	[]
>

type PRun<
	A,
	G,
	F,
	R,
	All extends readonly string[],
	Texts extends readonly unknown[],
	Index extends number,
	Stack extends number[],
	Values extends unknown[],
> =
	PChunk<A, G, F, R, All, Texts, Index, Peek<All, Index>, Stack, Values, ChunkSteps> extends infer C
		? C extends {
				index: infer I extends number
				stack: infer S extends number[]
				values: infer V extends unknown[]
			}
			? PRun<A, G, F, R, All, Texts, I, S, V>
			: C
		: never

/** `Chunk` with the value stack `Values` (top first, as `Stack`). */
type PChunk<
	A,
	G,
	F,
	R,
	All extends readonly string[],
	Texts extends readonly unknown[],
	Index extends number,
	Tok extends string,
	Stack extends number[],
	Values extends unknown[],
	Fuel extends number,
> = Fuel extends 0
	? { index: Index; stack: Stack; values: Values }
	: Stack extends [infer State extends number, ...unknown[]]
		? A extends Record<State, infer Row>
			? (
					Row extends Record<Tok, infer Explicit>
						? Explicit
						: Tok extends keyof F
							? Row extends Record<F[Tok] & string, infer Fallback>
								? Fallback
								: Default<Row>
							: Default<Row>
				) extends infer Action
				? Action extends number
					? Inc extends Record<Index, infer Next extends number>
						? PChunk<
								A,
								G,
								F,
								R,
								All,
								Texts,
								Next,
								Peek<All, Next>,
								[Action, ...Stack],
								[[Tok, Texts[Index]], ...Values],
								Step<Fuel>
							>
						: { ok: false; at: Index; token: "$too-long" }
					: Action extends [infer Pops extends unknown[], infer Item extends string, infer Key extends string]
						? Stack extends [...Pops, ...infer Popped extends number[]]
							? Values extends [...Pops, ...infer Below extends unknown[]]
								? Popped extends [infer Top extends number, ...unknown[]]
									? G extends Record<Top, Record<Item, infer Next extends number>>
										? PChunk<
												A,
												G,
												F,
												R,
												All,
												Texts,
												Index,
												Tok,
												[Next, ...Popped],
												[
													R extends Record<Key, infer Act extends SemanticAction>
														? CallAction<Act, Values>
														: Pops extends [unknown]
															? Values[0]
															: Key,
													...Below,
												],
												Step<Fuel>
											>
										: never
									: never
								: never
							: never
						: Action extends "accept"
							? { ok: true; value: Values[1] } // bison accepts after shifting $end
							: Action extends null
								? { ok: false; at: Index; token: Tok }
								: Stack extends [unknown, infer Below extends number, ...infer Deeper extends number[]]
									? Action extends Record<Below, infer Top extends number>
										? PChunk<
												A,
												G,
												F,
												R,
												All,
												Texts,
												Index,
												Tok,
												[Top, Below, ...Deeper],
												Values,
												Step<Fuel>
											>
										: never
									: never
				: never
			: { ok: false; at: Index; token: Tok }
		: never
