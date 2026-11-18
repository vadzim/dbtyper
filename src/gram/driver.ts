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
					: Action extends [infer Pops extends unknown[], infer Item extends string]
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
