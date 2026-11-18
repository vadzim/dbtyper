/**
 * bison-transform.ts
 *
 * Bison/Yacc grammars (.y files) are written for the bison parser generator and
 * are full of C code, semantic actions, and implicit operator-precedence tables
 * that make the grammar structure hard to read on its own.  This script strips
 * all of that away and rewrites the grammar as plain BNF that you can read,
 * diff, or feed into other tools without needing bison installed.
 *
 * Four transforms are applied in sequence:
 *
 * ── 1. STRIP ────────────────────────────────────────────────────────────────
 *   Removes everything that is not a grammar rule:
 *   • The C prologue / epilogue (code outside the %% delimiters)
 *   • All %token, %type, %union, %start, %expect … declarations
 *   • All semantic action blocks  { … }  (including nested braces)
 *   • All C-style block comments  /* … *\/  and line comments  //
 *   What remains is only the nonterminal definitions between the two %%.
 *
 * ── 2. PRECEDENCE → LAYERED RULES ───────────────────────────────────────────
 *   Bison grammars typically declare operator precedence and associativity
 *   with %left / %right / %nonassoc and rely on bison to resolve shift/reduce
 *   conflicts using those tables — so the grammar itself is ambiguous without
 *   the tool.  This transform makes the precedence explicit in the rule
 *   structure, the way a hand-written LL/PEG grammar would encode it.
 *
 *   Each operator token is assigned a numeric priority (index into the
 *   %left/%right/%nonassoc list, lowest first).  For every rule whose
 *   alternatives span more than one priority level the rule is split into a
 *   tower of single-level rules:
 *
 *     expr        ← handles the lowest-priority operators (e.g. OR)
 *     expr_p1     ← next level (e.g. AND)
 *     expr_p2     ← …
 *     expr_atom   ← non-operator base cases (literals, parenthesised exprs …)
 *
 *   Associativity is encoded structurally:
 *     %left  op  →  level_N : level_N op level_N+1  (left-recursive, cleaned by step 3)
 *     %right op  →  level_N : level_N+1 op level_N  (right-recursive, no further work)
 *     %nonassoc  →  level_N : level_N+1 op level_N+1 (no recursion at this level)
 *
 *   Step 2 runs before step 3 so that the left recursion it deliberately
 *   introduces in %left levels is then eliminated by step 3.
 *
 * ── 3. LEFT-FACTORING ───────────────────────────────────────────────────────
 *   When two or more alternatives in a rule share a common prefix token, that
 *   token is parsed only once and the rule branches into a "_rest" helper for
 *   the differing suffixes.
 *
 *   LL(1) requires that the FIRST sets of every pair of alternatives in a rule
 *   are disjoint (and, for nullable alternatives, that FIRST is also disjoint
 *   from FOLLOW).  Simple token-level left-factoring is not enough when two
 *   alternatives start with *different nonterminals* that both expand to the
 *   same terminal — the conflict is hidden behind nonterminal names.
 *
 *   The pipeline therefore alternates between two sub-steps:
 *     3a. FIRST-set-driven inlining: for each pair of alternatives in a rule
 *         whose FIRST sets overlap, inline the nonterminal(s) at the head of
 *         those alternatives so the shared terminal becomes visible at the
 *         surface level.  Only nonterminals whose full inlining would not
 *         introduce a cycle are inlined.
 *     3b. Token-level left-factoring: factor the longest common prefix out of
 *         every group of alternatives that share a leading token, introducing
 *         a "_rest" helper rule for the differing continuations.
 *   The two sub-steps repeat until no further progress is made.
 *
 *   LL(1) compliance is then verified as a hard requirement (not a warning):
 *   any remaining FIRST-set conflict is reported as an error.  Conflicts that
 *   survive after all mechanical transforms are genuinely unresolvable without
 *   semantic knowledge of the grammar and must be fixed by hand.
 *
 * ── 4. LEFT-RECURSION ELIMINATION ───────────────────────────────────────────
 *   Bison is LALR and handles left-recursive rules fine, but many downstream
 *   tools (LL parsers, PEG engines, humans reading top-down) cannot.  Any rule
 *   of the form
 *       A : A α₁ | A α₂ | … | β₁ | β₂ | …
 *   is mechanically rewritten to right-recursive equivalents:
 *       A      : β₁ A_rest | β₂ A_rest | …
 *       A_rest : α₁ A_rest | α₂ A_rest | ε
 *   Only *immediate* (direct) left recursion is handled.  Mutual recursion is
 *   left as-is because resolving it automatically requires full semantic
 *   knowledge of the grammar.
 *   Name collisions are avoided: if "A_rest" already exists the suffix becomes
 *   "_rest2", "_rest3", and so on.
 *
 * Requirements:
 *   Node.js ≥ 26  — DO NOT LOWER THIS REQUIREMENT.
 *   No npm dependencies — only Node built-ins are used.
 *
 * Usage:
 *   node bison-transform.ts <input.y> [output.txt]
 *   npx tsx bison-transform.ts <input.y> [output.txt]
 *
 * If no input file is given or it is "-" the data is read from stdin.
 * If no output file is given the result is written to stdout.
 *
 * Development:
 *   This doc should be kept updated.
 *   Typescript rules are as strict as possible.
 *
 * TypeScript compiler settings required for this file to pass strict checking:
 *   strict, strictNullChecks, noUncheckedIndexedAccess,
 *   exactOptionalPropertyTypes, noImplicitAny, noImplicitReturns,
 *   noFallthroughCasesInSwitch
 */

import { readFile, writeFile } from "fs/promises"
import { argv, stdout } from "process"

if (argv.includes("--help")) {
	console.error("Usage: bison-transform.ts [<input.y>] [output.txt]")
	console.error("Default is stdin/stdout. Use - for explicit stdin.")
	process.exit(1)
}

// ---------------------------------------------------------------------------
// Utility: crash helper used instead of the non-null assertion operator (!)
// ---------------------------------------------------------------------------

/** Throws unconditionally.  Use as `value ?? never("reason")` to satisfy
 *  strictNullChecks without silencing the check with `!`. */
function never(msg: string): never {
	throw new Error(`Invariant violated: ${msg}`)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alternative {
	/** RHS symbols after stripping semantic actions. */
	symbols: string[]
	/** Explicit %prec override, if present. */
	prec?: string
}

interface Rule {
	name: string
	alts: Alternative[]
}

interface PrecLevel {
	assoc: "left" | "right" | "nonassoc"
	tokens: string[]
}

interface Grammar {
	rules: Rule[]
	/** Precedence levels, lowest priority first (order of declaration). */
	precLevels: PrecLevel[]
}

// ---------------------------------------------------------------------------
// Step 0 – low-level text helpers
// ---------------------------------------------------------------------------

/** Strip C semantic action blocks { … } tracking brace depth. */
function stripActions(s: string): string {
	let out = ""
	let depth = 0
	for (let i = 0; i < s.length; i++) {
		const ch = s[i] ?? never(`out-of-bounds read at ${i}`)
		if (ch === "{") {
			depth++
			continue
		}
		if (ch === "}") {
			depth--
			continue
		}
		if (depth === 0) out += ch
	}
	return out
}

/** Remove block comments and C++ line comments. */
function stripComments(s: string): string {
	s = s.replace(/\/\*[\s\S]*?\*\//g, " ")
	s = s.replace(/\/\/.*/g, "")
	return s
}

/**
 * Find the index of the first bare semicolon starting at `from`.
 * Semicolons inside single-quoted char tokens (e.g. ';') are skipped.
 * Returns -1 if not found.
 */
function findRuleSemi(s: string, from: number): number {
	for (let i = from; i < s.length; i++) {
		const ch = s[i] ?? never(`findRuleSemi out-of-bounds at ${i}`)
		if (ch === "'") {
			i++ // skip opening quote
			while (i < s.length && s[i] !== "'") i++
			continue
		}
		if (ch === ";") return i
	}
	return -1
}

/**
 * Split `s` on bare pipe characters '|', skipping any '|' that appears
 * inside a single-quoted token literal (e.g. the bison token '|').
 */
function splitOnPipe(s: string): string[] {
	const parts: string[] = []
	let cur = ""
	for (let i = 0; i < s.length; i++) {
		const ch = s[i] ?? never(`splitOnPipe out-of-bounds at ${i}`)
		if (ch === "'") {
			cur += ch
			i++
			while (i < s.length && s[i] !== "'") {
				cur += s[i] ?? never(`splitOnPipe quote scan at ${i}`)
				i++
			}
			if (i < s.length) cur += s[i] ?? never(`splitOnPipe closing quote at ${i}`)
			continue
		}
		if (ch === "|") {
			parts.push(cur)
			cur = ""
		} else cur += ch
	}
	parts.push(cur)
	return parts
}

// ---------------------------------------------------------------------------
// Step 1 – parse the .y file
// ---------------------------------------------------------------------------

function extractRulesSection(src: string): { rulesText: string; declSection: string } {
	const firstSep = src.indexOf("%%")
	const lastSep = src.lastIndexOf("%%")
	if (firstSep === -1 || firstSep === lastSep) {
		throw new Error("Could not locate both %% section separators in input file")
	}
	return {
		declSection: src.slice(0, firstSep),
		rulesText: src.slice(firstSep + 2, lastSep),
	}
}

function parsePrecDecls(declSection: string): PrecLevel[] {
	const levels: PrecLevel[] = []
	for (const rawLine of declSection.split("\n")) {
		// Strip inline block comments before matching
		const line = rawLine.replace(/\/\*.*?\*\//g, "").trim()
		const m = line.match(/^%(left|right|nonassoc)\s+(.+)/)
		if (m === null) continue
		const assoc = m[1] as "left" | "right" | "nonassoc"
		const tokenPart = (m[2] ?? never("regex group 2 missing")).trim()
		const tokens: string[] = []
		for (const tok of tokenPart.matchAll(/'[^']+'|[A-Za-z_][A-Za-z0-9_]*/g)) {
			tokens.push(tok[0])
		}
		if (tokens.length > 0) levels.push({ assoc, tokens })
	}
	return levels
}

function parseRules(rulesText: string): Rule[] {
	const clean = stripComments(stripActions(rulesText))
	const rules: Rule[] = []

	// Locate every  ruleName :  header (anchored to start-of-line)
	const ruleStartRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/gm
	const starts: Array<{ name: string; bodyStart: number }> = []
	for (const m of clean.matchAll(ruleStartRe)) {
		starts.push({
			name: m[1] ?? never("rule name capture missing"),
			bodyStart: m.index + m[0].length,
		})
	}

	for (let i = 0; i < starts.length; i++) {
		const { name, bodyStart } = starts[i] ?? never(`starts[${i}] missing`)

		// Body ends just before the next rule header (or at EOF)
		const nextHeaderOffset =
			i + 1 < starts.length
				? (starts[i + 1] ?? never(`starts[${i + 1}] missing`)).bodyStart -
					(starts[i + 1] ?? never(`starts[${i + 1}] missing`)).name.length -
					1
				: clean.length

		const body = clean.slice(bodyStart, nextHeaderOffset)

		// Trim to the rule-terminating semicolon
		const semiIdx = findRuleSemi(body, 0)
		const bodyCore = semiIdx >= 0 ? body.slice(0, semiIdx) : body

		const alts: Alternative[] = []
		for (const altStr of splitOnPipe(bodyCore)) {
			const trimmed = altStr.trim()

			// Detect %prec OVERRIDE at the end of an alternative
			let prec: string | undefined
			let symbolStr = trimmed
			const precM = trimmed.match(/^([\s\S]*?)\s+%prec\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/)
			if (precM !== null) {
				symbolStr = (precM[1] ?? never("precM group 1")).trim()
				prec = precM[2] ?? never("precM group 2")
			}

			// Collect symbol tokens: single-quoted char literals and bare identifiers
			const symbols: string[] = []
			for (const tok of symbolStr.matchAll(/'[^']*'|[A-Za-z_][A-Za-z0-9_]*/g)) {
				symbols.push(tok[0])
			}

			// Empty alternative is a valid ε production
			const alt: Alternative = prec !== undefined ? { symbols, prec } : { symbols }
			alts.push(alt)
		}

		if (alts.length > 0) rules.push({ name, alts })
	}

	return rules
}

// ---------------------------------------------------------------------------
// Step 2 – precedence declarations → explicit layered rules
// ---------------------------------------------------------------------------

function buildPrecRules(grammar: Grammar): Rule[] {
	const { rules, precLevels } = grammar
	if (precLevels.length === 0) return rules

	const tokenMeta = new Map<string, { level: number; assoc: "left" | "right" | "nonassoc" }>()
	for (let i = 0; i < precLevels.length; i++) {
		const pl = precLevels[i] ?? never(`precLevels[${i}]`)
		for (const tok of pl.tokens) {
			tokenMeta.set(tok, { level: i, assoc: pl.assoc })
		}
	}

	function altMeta(alt: Alternative): { level: number; assoc: "left" | "right" | "nonassoc" } | undefined {
		if (alt.prec !== undefined) {
			const m = tokenMeta.get(alt.prec)
			if (m !== undefined) return m
		}
		let best: { level: number; assoc: "left" | "right" | "nonassoc" } | undefined
		for (const sym of alt.symbols) {
			const m = tokenMeta.get(sym)
			if (m !== undefined && (best === undefined || m.level > best.level)) best = m
		}
		return best
	}

	const synthRules: Rule[] = []

	for (const rule of rules) {
		const opAlts: Array<{ alt: Alternative; level: number; assoc: "left" | "right" | "nonassoc" }> = []
		const otherAlts: Alternative[] = []

		for (const alt of rule.alts) {
			const m = altMeta(alt)
			if (m !== undefined) opAlts.push({ alt, level: m.level, assoc: m.assoc })
			else otherAlts.push(alt)
		}

		const uniqueLevels = new Set(opAlts.map(x => x.level))
		if (uniqueLevels.size <= 1) {
			synthRules.push(rule)
			continue
		}

		const byLevel = new Map<number, Array<{ alt: Alternative; assoc: "left" | "right" | "nonassoc" }>>()
		for (const entry of opAlts) {
			const bucket = byLevel.get(entry.level) ?? []
			bucket.push(entry)
			byLevel.set(entry.level, bucket)
		}

		const sortedLevels = [...uniqueLevels].sort((a, b) => a - b)
		const atomName = `${rule.name}_atom`

		for (let i = 0; i < sortedLevels.length; i++) {
			const lvl = sortedLevels[i] ?? never(`sortedLevels[${i}]`)
			const layerName = i === 0 ? rule.name : `${rule.name}_p${i}`
			const tighterLayer = i + 1 < sortedLevels.length ? `${rule.name}_p${i + 1}` : atomName

			const levelAlts: Alternative[] = (byLevel.get(lvl) ?? []).map(({ alt, assoc }) => {
				const selfIndices = alt.symbols.map((s, idx) => (s === rule.name ? idx : -1)).filter(idx => idx !== -1)

				const result = [...alt.symbols]
				if (assoc === "left") {
					for (let k = 0; k < selfIndices.length; k++) {
						const idx = selfIndices[k] ?? never(`selfIndices[${k}]`)
						result[idx] = k === 0 ? layerName : tighterLayer
					}
				} else if (assoc === "right") {
					for (let k = 0; k < selfIndices.length; k++) {
						const idx = selfIndices[k] ?? never(`selfIndices[${k}]`)
						result[idx] = k === selfIndices.length - 1 ? layerName : tighterLayer
					}
				} else {
					for (const idx of selfIndices) {
						result[idx] = tighterLayer
					}
				}

				const newAlt: Alternative =
					alt.prec !== undefined ? { symbols: result, prec: alt.prec } : { symbols: result }
				return newAlt
			})

			levelAlts.push({ symbols: [tighterLayer] })
			synthRules.push({ name: layerName, alts: levelAlts })
		}

		const atomAlts: Alternative[] = otherAlts.map(alt => {
			const syms = alt.symbols.map(s => (s === rule.name ? atomName : s))
			const newAlt: Alternative = alt.prec !== undefined ? { symbols: syms, prec: alt.prec } : { symbols: syms }
			return newAlt
		})
		if (atomAlts.length === 0) atomAlts.push({ symbols: [] })

		synthRules.push({ name: atomName, alts: atomAlts })
	}

	return synthRules
}

// ---------------------------------------------------------------------------
// FIRST / FOLLOW set computation
// ---------------------------------------------------------------------------
//
// These sets are the foundation of LL(1) analysis.
//
// FIRST(A) = the set of terminals that can begin any string derived from A,
//            plus the special symbol ε if A can derive the empty string.
//
// FOLLOW(A) = the set of terminals that can appear immediately to the right
//             of A in some sentential form.  Used only for nullable rules:
//             if ε ∈ FIRST(A) then the alternative "A" is LL(1)-valid only
//             when its FOLLOW set is disjoint from the FIRST sets of the
//             other alternatives in the same rule.
//
// Both sets are computed to a fixed point using standard worklist iteration.

const EPSILON = "ε" // sentinel — never a real grammar symbol

/** Build a map from every nonterminal name to its FIRST set (terminals + ε). */
function computeFirstSets(rules: Rule[]): Map<string, Set<string>> {
	const ruleIndex = new Map<string, Rule>()
	for (const r of rules) ruleIndex.set(r.name, r)

	const first = new Map<string, Set<string>>()
	for (const r of rules) first.set(r.name, new Set())

	// Helper: add terminals reachable from a symbol sequence to `out`.
	// Returns true if the sequence can derive ε.
	function addFirstOfSeq(symbols: string[], out: Set<string>): boolean {
		if (symbols.length === 0) {
			out.add(EPSILON)
			return true
		}
		for (const sym of symbols) {
			if (!ruleIndex.has(sym)) {
				// Terminal
				out.add(sym)
				return false
			}
			const fs = first.get(sym) ?? new Set()
			for (const t of fs) {
				if (t !== EPSILON) out.add(t)
			}
			if (!fs.has(EPSILON)) return false
		}
		out.add(EPSILON)
		return true
	}

	// Fixed-point iteration
	let changed = true
	while (changed) {
		changed = false
		for (const rule of rules) {
			const fs = first.get(rule.name) ?? never(`FIRST missing for ${rule.name}`)
			const before = fs.size
			for (const alt of rule.alts) {
				addFirstOfSeq(alt.symbols, fs)
			}
			if (fs.size !== before) changed = true
		}
	}

	return first
}

/** Build a map from every nonterminal name to its FOLLOW set (terminals only). */
function computeFollowSets(rules: Rule[], firstSets: Map<string, Set<string>>): Map<string, Set<string>> {
	const ruleIndex = new Map<string, Rule>()
	for (const r of rules) ruleIndex.set(r.name, r)

	const follow = new Map<string, Set<string>>()
	for (const r of rules) follow.set(r.name, new Set())

	// The start symbol can be followed by end-of-input ($)
	if (rules.length > 0) {
		const startName = (rules[0] ?? never("rules[0] missing")).name
		;(follow.get(startName) ?? never(`FOLLOW missing for ${startName}`)).add("$")
	}

	// Helper: FIRST of a symbol sequence (returns Set<string> including ε if nullable)
	function firstOfSeq(symbols: string[]): Set<string> {
		const out = new Set<string>()
		for (const sym of symbols) {
			if (!ruleIndex.has(sym)) {
				out.add(sym)
				return out // terminal stops propagation, not nullable
			}
			const fs = firstSets.get(sym) ?? new Set()
			for (const t of fs) {
				if (t !== EPSILON) out.add(t)
			}
			if (!fs.has(EPSILON)) return out
		}
		out.add(EPSILON)
		return out
	}

	let changed = true
	while (changed) {
		changed = false
		for (const rule of rules) {
			const followA = follow.get(rule.name) ?? never(`FOLLOW missing for ${rule.name}`)
			for (const alt of rule.alts) {
				for (let i = 0; i < alt.symbols.length; i++) {
					const sym = alt.symbols[i] ?? never(`symbol ${i} missing`)
					if (!ruleIndex.has(sym)) continue // terminal, skip
					const followB = follow.get(sym) ?? never(`FOLLOW missing for ${sym}`)
					const before = followB.size

					// FIRST of what follows sym in this alternative
					const rest = alt.symbols.slice(i + 1)
					const firstRest = firstOfSeq(rest)
					for (const t of firstRest) {
						if (t !== EPSILON) followB.add(t)
					}
					// If rest can derive ε, everything in FOLLOW(rule) is in FOLLOW(sym)
					if (firstRest.has(EPSILON)) {
						for (const t of followA) followB.add(t)
					}

					if (followB.size !== before) changed = true
				}
			}
		}
	}

	return follow
}

// ---------------------------------------------------------------------------
// LL(1) conflict detection
// ---------------------------------------------------------------------------
//
// For a rule  A : α₁ | α₂ | … | αₙ  to be LL(1):
//   • For every i ≠ j: FIRST(αᵢ) ∩ FIRST(αⱼ) = ∅
//   • For every i where ε ∈ FIRST(αᵢ): FOLLOW(A) ∩ FIRST(αⱼ) = ∅ for all j ≠ i
//
// We report each conflicting token and which alternative indices conflict.

interface LL1Conflict {
	ruleName: string
	token: string
	/** Zero-based indices of alternatives whose FIRST sets contain `token`. */
	altIndices: number[]
}

/** Compute FIRST of a single alternative given the nonterminal FIRST sets. */
function firstOfAlt(alt: Alternative, firstSets: Map<string, Set<string>>): Set<string> {
	const out = new Set<string>()
	for (const sym of alt.symbols) {
		const fs = firstSets.get(sym)
		if (fs === undefined) {
			// Terminal
			out.add(sym)
			return out
		}
		for (const t of fs) {
			if (t !== EPSILON) out.add(t)
		}
		if (!fs.has(EPSILON)) return out
	}
	out.add(EPSILON) // whole sequence nullable
	return out
}

function findLL1Conflicts(
	rules: Rule[],
	firstSets: Map<string, Set<string>>,
	followSets: Map<string, Set<string>>,
): LL1Conflict[] {
	const conflicts: LL1Conflict[] = []

	for (const rule of rules) {
		// For each alternative, collect its effective prediction set:
		//   FIRST(alt) ∪ (ε ∈ FIRST(alt) ? FOLLOW(rule) : ∅)
		const predSets: Set<string>[] = rule.alts.map(alt => {
			const fs = firstOfAlt(alt, firstSets)
			const pred = new Set<string>()
			for (const t of fs) {
				if (t !== EPSILON) pred.add(t)
			}
			if (fs.has(EPSILON)) {
				const fw = followSets.get(rule.name) ?? new Set()
				for (const t of fw) pred.add(t)
			}
			return pred
		})

		// Find any terminal that appears in more than one prediction set
		const tokenToAlts = new Map<string, number[]>()
		for (let i = 0; i < predSets.length; i++) {
			const ps = predSets[i] ?? never(`predSets[${i}]`)
			for (const t of ps) {
				const list = tokenToAlts.get(t) ?? []
				list.push(i)
				tokenToAlts.set(t, list)
			}
		}
		for (const [token, indices] of tokenToAlts) {
			if (indices.length > 1) {
				conflicts.push({ ruleName: rule.name, token, altIndices: indices })
			}
		}
	}

	return conflicts
}

// ---------------------------------------------------------------------------
// Step 3a – FIRST-set-driven inlining
// ---------------------------------------------------------------------------
//
// When two alternatives in a rule have overlapping FIRST sets and the conflict
// is caused by different *nonterminals* at the head of those alternatives
// (rather than the same terminal), we inline those nonterminals to expose the
// shared terminal so that token-level left-factoring (step 3b) can resolve it.
//
// A nonterminal N is eligible for inlining at position i of alternative A if:
//   1. N is the first symbol of A (i = 0) — we only inline at the head.
//   2. Inlining N does not introduce a cycle (N's own alternatives must not
//      start with N itself, directly or transitively through eligible rules).
//   3. N does not have an epsilon production — inlining ε-producers changes
//      the FOLLOW requirements of the parent and is left to the user.
//
// We inline the *minimal* set of nonterminals needed to expose each conflict.
// Specifically: for each pair of conflicting alternatives, inline whichever
// head nonterminal has the smaller set of alternatives (prefer less expansion).
// If both heads are terminals, the conflict is not resolvable by inlining and
// is left for the hard-error report.

function firstDrivenInline(rules: Rule[]): { rules: Rule[]; inlinedCount: number } {
	const ruleIndex = new Map<string, Rule>()
	for (const r of rules) ruleIndex.set(r.name, r)

	// Check whether nonterminal `name` has a direct or transitive ε production
	// (only looking at heads — used to filter out unsafe candidates).
	const nullableCache = new Map<string, boolean>()
	function isNullable(name: string, visiting: Set<string> = new Set()): boolean {
		const cached = nullableCache.get(name)
		if (cached !== undefined) return cached
		const rule = ruleIndex.get(name)
		if (rule === undefined) return false // terminal
		if (visiting.has(name)) return false // cycle guard
		const next = new Set(visiting).add(name)
		const result = rule.alts.some(a => a.symbols.length === 0 || (a.symbols[0] !== undefined && isNullable(a.symbols[0], next)))
		nullableCache.set(name, result)
		return result
	}

	// Check whether inlining `name` could introduce a cycle (i.e. name appears
	// in FIRST of one of its own alternatives, directly or indirectly).
	const cycleCache = new Map<string, boolean>()
	function wouldCycle(name: string, visiting: Set<string> = new Set()): boolean {
		const cached = cycleCache.get(name)
		if (cached !== undefined) return cached
		const rule = ruleIndex.get(name)
		if (rule === undefined) return false
		if (visiting.has(name)) return true
		const next = new Set(visiting).add(name)
		const result = rule.alts.some(alt => {
			const head = alt.symbols[0]
			if (head === undefined) return false
			if (head === name) return true
			return ruleIndex.has(head) && wouldCycle(head, next)
		})
		cycleCache.set(name, result)
		return result
	}

	// Determine which nonterminal names will be inlined into which parent rules.
	// Maps parentRuleName → Set of nonterminal names to inline at the head.
	const inlineTargets = new Map<string, Set<string>>()

	const firstSets = computeFirstSets(rules)
	const followSets = computeFollowSets(rules, firstSets)
	const conflicts = findLL1Conflicts(rules, firstSets, followSets)

	for (const conflict of conflicts) {
		const rule = ruleIndex.get(conflict.ruleName)
		if (rule === undefined) continue

		// Collect conflicting alternative indices and their head symbols
		const conflictingAlts = conflict.altIndices
			.map(i => ({ i, alt: rule.alts[i] ?? never(`alt ${i} missing`) }))

		// For each conflicting alternative, identify whether its head is a
		// nonterminal that is safe to inline (no ε, no cycle, defined in grammar).
		const candidates = conflictingAlts
			.map(({ i, alt }) => {
				const head = alt.symbols[0]
				if (head === undefined) return null // ε alternative — skip
				if (!ruleIndex.has(head)) return null // terminal — can't inline
				if (isNullable(head)) return null // ε-producing — unsafe
				if (wouldCycle(head)) return null // would introduce cycle
				const headRule = ruleIndex.get(head) ?? never(`rule ${head} missing`)
				return { i, head, altCount: headRule.alts.length }
			})
			.filter((x): x is { i: number; head: string; altCount: number } => x !== null)

		if (candidates.length === 0) continue // conflict not resolvable by inlining

		// Inline the candidate with the fewest alternatives (minimal expansion).
		// If there's only one candidate, inline it.
		const best = candidates.reduce((a, b) => (a.altCount <= b.altCount ? a : b))
		const targets = inlineTargets.get(conflict.ruleName) ?? new Set<string>()
		targets.add(best.head)
		inlineTargets.set(conflict.ruleName, targets)
	}

	if (inlineTargets.size === 0) return { rules, inlinedCount: 0 }

	// Collect all nonterminals that will be inlined (across all parent rules)
	// so we know which Rule entries to remove from the output.
	// Note: a nonterminal may be inlined into one parent but still referenced
	// by others — we only remove rules that are inlined into EVERY parent that
	// references them.  This is conservative: we leave the rule in place and
	// just splice its alternatives into the specific parents that need it.
	// The original rule stays (it may still be needed elsewhere).

	let inlinedCount = 0
	const outRules: Rule[] = []

	for (const rule of rules) {
		const targets = inlineTargets.get(rule.name)
		if (targets === undefined || targets.size === 0) {
			outRules.push(rule)
			continue
		}

		// Expand alternatives: if an alternative starts with a target nonterminal,
		// replace it with the alternatives of that nonterminal (prepending each).
		const newAlts: Alternative[] = []
		for (const alt of rule.alts) {
			const head = alt.symbols[0]
			if (head !== undefined && targets.has(head)) {
				const headRule = ruleIndex.get(head) ?? never(`rule ${head} missing`)
				for (const ia of headRule.alts) {
					// Splice: inline's symbols + rest of original alternative
					const combined = [...ia.symbols, ...alt.symbols.slice(1)]

					const newAlt: Alternative =

						alt.prec !== undefined || ia.prec !== undefined

							? { symbols: combined, prec: (alt.prec ?? ia.prec) ?? never("Expected prec to be defined here") }
							: { symbols: combined }
					newAlts.push(newAlt)
				}
				inlinedCount++
			} else {
				newAlts.push(alt)
			}
		}
		outRules.push({ name: rule.name, alts: newAlts })
	}

	return { rules: outRules, inlinedCount }
}

// ---------------------------------------------------------------------------
// Step 3b – left-factoring (token-level)
// ---------------------------------------------------------------------------
//
// When two or more alternatives share the same first token, that token should
// be consumed exactly once.  We factor the common prefix out into the parent
// rule and introduce a "_rest" helper for the differing continuations.
//
// The transform is applied iteratively until no rule has two alternatives that
// start with the same symbol.  This handles multi-token shared prefixes
// because each iteration factors one symbol deeper.

function leftFactor(rules: Rule[]): { rules: Rule[]; helpersAdded: number } {
	const ruleNames = new Set(rules.map(r => r.name))

	function freshRestName(base: string): string {
		let candidate = `${base}_rest`
		let n = 2
		while (ruleNames.has(candidate)) candidate = `${base}_rest${n++}`
		ruleNames.add(candidate)
		return candidate
	}

	let changed = true
	let current = rules
	let totalHelpers = 0

	while (changed) {
		changed = false
		const next: Rule[] = []

		for (const rule of current) {
			const groups = new Map<string, Alternative[]>()
			const epsilonAlts: Alternative[] = []

			for (const alt of rule.alts) {
				const first = alt.symbols[0]
				if (first === undefined) {
					epsilonAlts.push(alt)
				} else {
					const bucket = groups.get(first) ?? []
					bucket.push(alt)
					groups.set(first, bucket)
				}
			}

			const needsFactoring = [...groups.values()].some(g => g.length > 1)
			if (!needsFactoring) {
				next.push(rule)
				continue
			}

			changed = true

			const newAlts: Alternative[] = [...epsilonAlts]
			const helpers: Rule[] = []

			for (const [first, group] of groups) {
				if (group.length === 1) {
					newAlts.push(group[0] ?? never(`singleton group for ${first}`))
					continue
				}

				const restName = freshRestName(rule.name)
				newAlts.push({ symbols: [first, restName] })

				const restAlts: Alternative[] = group.map(alt => {
					const suffix = alt.symbols.slice(1)
					const newAlt: Alternative =
						alt.prec !== undefined ? { symbols: suffix, prec: alt.prec } : { symbols: suffix }
					return newAlt
				})

				helpers.push({ name: restName, alts: restAlts })
				totalHelpers++
			}

			next.push({ name: rule.name, alts: newAlts })
			next.push(...helpers)
		}

		current = next
	}

	return { rules: current, helpersAdded: totalHelpers }
}

// ---------------------------------------------------------------------------
// Step 3 – combined LL(1) normalization pipeline
// ---------------------------------------------------------------------------
//
// Alternates between FIRST-set-driven inlining (3a) and token-level
// left-factoring (3b) until neither makes progress.  Then verifies LL(1)
// compliance as a hard requirement.

function normalizeLL1(rules: Rule[]): Rule[] {
	let current = rules
	let round = 0
	const MAX_ROUNDS = 40 // safety valve

	while (round++ < MAX_ROUNDS) {
		// 3a: inline nonterminals that are causing FIRST-set conflicts
		const { rules: afterInline, inlinedCount } = firstDrivenInline(current)
		current = afterInline

		// 3b: token-level left-factoring
		const { rules: afterFactor, helpersAdded } = leftFactor(current)
		current = afterFactor

		if (inlinedCount === 0 && helpersAdded === 0) break // fixed point
	}

	console.error(`  LL(1) normalization: ${round} round(s)`)

	return current
}

// ---------------------------------------------------------------------------
// Step 4 – immediate left-recursion → right-recursion
// ---------------------------------------------------------------------------

function eliminateLeftRecursion(rules: Rule[]): Rule[] {
	const ruleNames = new Set(rules.map(r => r.name))

	function freshRestName(base: string): string {
		let candidate = `${base}_rest`
		let n = 2
		while (ruleNames.has(candidate)) candidate = `${base}_rest${n++}`
		ruleNames.add(candidate)
		return candidate
	}

	const out: Rule[] = []
	for (const rule of rules) {
		const leftRec = rule.alts.filter(a => a.symbols[0] === rule.name)
		const nonLeftRec = rule.alts.filter(a => a.symbols[0] !== rule.name)

		if (leftRec.length === 0) {
			out.push(rule)
			continue
		}

		const restName = freshRestName(rule.name)

		const baseAlts: Alternative[] = nonLeftRec.map(a => {
			const alt: Alternative =
				a.prec !== undefined
					? { symbols: [...a.symbols, restName], prec: a.prec }
					: { symbols: [...a.symbols, restName] }
			return alt
		})

		if (baseAlts.length === 0) {
			baseAlts.push({ symbols: [restName] })
		}

		const restAlts: Alternative[] = leftRec.map(a => {
			const alt: Alternative =
				a.prec !== undefined
					? { symbols: [...a.symbols.slice(1), restName], prec: a.prec }
					: { symbols: [...a.symbols.slice(1), restName] }
			return alt
		})
		restAlts.push({ symbols: [] })

		out.push({ name: rule.name, alts: baseAlts })
		out.push({ name: restName, alts: restAlts })
	}
	return out
}

// ---------------------------------------------------------------------------
// Step 5 – render to text
// ---------------------------------------------------------------------------

function renderGrammar(rules: Rule[]): string {
	const lines: string[] = []
	for (const rule of rules) {
		const alts = [...rule.alts.filter(a => a.symbols.length > 0), ...rule.alts.filter(a => a.symbols.length === 0)]
		const altLines = alts.map((alt, i) => {
			const syms = alt.symbols.length === 0 ? "/* empty */" : alt.symbols.join(" ")
			const prec = alt.prec !== undefined ? ` %prec ${alt.prec}` : ""
			if (i === 0) return `${rule.name}:\n      ${syms}${prec}`
			return `    | ${syms}${prec}`
		})
		lines.push(altLines.join("\n") + "\n    ;")
		lines.push("")
	}
	return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Verification – LL(1) hard check + summary
// ---------------------------------------------------------------------------

function verifyAndReport(rules: Rule[]): void {
	const firstSets = computeFirstSets(rules)
	const followSets = computeFollowSets(rules, firstSets)
	const conflicts = findLL1Conflicts(rules, firstSets, followSets)

	if (conflicts.length === 0) {
		console.error("  LL(1) verification: PASS — no prediction-set conflicts")
		return
	}

	// Group conflicts by rule for a readable report
	const byRule = new Map<string, LL1Conflict[]>()
	for (const c of conflicts) {
		const list = byRule.get(c.ruleName) ?? []
		list.push(c)
		byRule.set(c.ruleName, list)
	}

	console.error(`  LL(1) verification: FAIL — ${conflicts.length} conflict(s) in ${byRule.size} rule(s)`)
	console.error("  These conflicts require manual resolution (semantic ambiguity the transforms cannot eliminate):")
	let shown = 0
	for (const [ruleName, cs] of byRule) {
		if (shown++ >= 20) {
			console.error(`  … and ${byRule.size - 20} more rule(s)`)
			break
		}
		const rule = rules.find(r => r.name === ruleName)
		for (const c of cs) {
			const altTexts = c.altIndices.map(i => {
				const alt = rule?.alts[i]
				if (alt === undefined) return `alt[${i}]`
				return alt.symbols.length === 0 ? "ε" : alt.symbols.slice(0, 4).join(" ") + (alt.symbols.length > 4 ? " …" : "")
			})
			console.error(`    ${ruleName}: token '${c.token}' in alts: ${altTexts.join("  |  ")}`)
		}
	}

	// Hard error: exit non-zero so CI/build pipelines catch it
	process.exitCode = 1
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [, , inputFile, outputFile] = argv

console.error(`Reading ${inputFile ?? "stdin"}…`)
const src =
	inputFile && inputFile !== "-" ? await readFile(inputFile, "utf8") : (await Array.fromAsync(process.stdin)).join("")

const { rulesText, declSection } = extractRulesSection(src)
const precLevels = parsePrecDecls(declSection)
console.error(`  Found ${precLevels.length} precedence level(s)`)

let rules = parseRules(rulesText)
console.error(`  Found ${rules.length} grammar rule(s)`)

// Step 2: build explicit precedence tower (may introduce left recursion in
// %left levels; step 4 cleans those up).
const grammar: Grammar = { rules, precLevels }
rules = buildPrecRules(grammar)
const precRuleCount = rules.filter(r => /_p\d+$/.test(r.name) || r.name.endsWith("_atom")).length
console.error(`  Precedence-tower rules added: ${precRuleCount}`)

// Step 3: LL(1) normalization — alternates FIRST-set-driven inlining with
// token-level left-factoring until a fixed point, then hard-checks LL(1).
const beforeNorm = rules.length
rules = normalizeLL1(rules)
const normDelta = rules.length - beforeNorm
console.error(`  Rules after LL(1) normalization: ${rules.length} (${normDelta >= 0 ? "+" : ""}${normDelta})`)

// Step 4: eliminate any remaining immediate left recursion introduced by the
// precedence tower's %left levels.
const beforeLR = rules.length
rules = eliminateLeftRecursion(rules)
const lrHelpers = rules.length - beforeLR
console.error(`  Left-recursion eliminated: ${lrHelpers} helper rule(s) added`)

console.error("")
verifyAndReport(rules)

const output = renderGrammar(rules)

if (outputFile !== undefined) {
	await writeFile(outputFile, output, "utf8")
} else {
	stdout.write(output)
}
console.error(`\nWritten to ${outputFile ?? "stdout"} (${output.length.toLocaleString()} chars)`)
