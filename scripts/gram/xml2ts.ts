import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"

// usage: node scripts/gram/xml2ts.ts <dialect dir>   (reads <dir>/gram.xml, writes <dir>/tables.d.ts)
const dialectDir = process.argv[2] ?? never("usage: xml2ts.ts <dialect dir>")

/*
<state number="5261">
	<actions>
	<transitions>
		<transition type="shift" symbol="'('" state="5660"/>
		<transition type="goto" symbol="copy_options" state="5661"/>
		<transition type="goto" symbol="copy_opt_list" state="5662"/>
	</transitions>
	<reductions>
		<reduction symbol="$default" rule="446" enabled="true"/>
	</reductions>
	</actions>
</state>

const x = { a: 1, b: 3, c: 4 } as const
type X = typeof x

type I<A, N extends string | number, D> =
	A extends Record<string | number, number> ? (A[N] extends infer R ? (unknown extends R ? D : R) : never) : D

type Y = I<X, "aa", null>
type Z = I<X, "a", null>
type Z1 = I<null, "a", undefined>
*/

console.error("reading xml")

const raw = await readFile(dialectDir + "/gram.xml", "utf8")

let xml = new (await import(`fast-xml-parser`)).XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: `@`,
	parseAttributeValue: false,
}).parse(raw)

console.error("parsing data")

const toArr = (x: unknown): any[] => (x == null ? [] : [x].flat())

type SuperSet<T> = Set<T | SuperSet<T>>

/**
 * Row sharing. Rows (one per state) are sets of `key\0value` strings; rows that have many entries in common are
 * split into named parts (`interface T<n>`), and a row is `interface A<n> extends T1, T2 { own entries }`. An interface
 * with bases is resolved once into one flat member table, so a lookup is a hash probe (an intersection type is not).
 */
function makeSharer() {
	const sets = new Array<SuperSet<string>>()
	const sizes = new WeakMap<SuperSet<string>, number>()

	const getSetSize = (s: SuperSet<string>): number => {
		const known = sizes.get(s)
		if (known !== undefined) return known
		let size = 0
		for (const x of s) size += typeof x === "string" ? 1 : getSetSize(x)
		sizes.set(s, size)
		return size
	}

	const replaceItems = <T>(s: Set<T>, i: Set<T>, j: T) => {
		for (const p of i) s.delete(p)
		s.add(j)
	}

	const add = (s: SuperSet<string>): SuperSet<string> => {
		if (s.size === 0) never("set is empty")

		using $ = new DisposableStack()

		const toInsert: SuperSet<string>[] = []
		$.defer(() => {
			if (toInsert.length > 0) {
				sets.push(...toInsert)
				sets.sort((a, b) => getSetSize(a) - getSetSize(b))
			}
		})

		for (const p of sets) {
			const i = p.intersection(s)
			if (i.size === 0 || (i.size === 1 && i.values().find(() => true) instanceof Set)) {
				continue
			}
			if (i.size === s.size) {
				if (i.size === p.size) {
					return p
				} else {
					replaceItems(p, i, s)
					toInsert.push(s)
					return s
				}
			} else {
				if (i.size === p.size) {
					replaceItems(s, i, p)
				} else {
					replaceItems(s, i, i)
					replaceItems(p, i, i)
					toInsert.push(i)
				}
			}
		}
		toInsert.push(s)
		return s
	}

	const finish = () => {
		for (const s of sets) {
			for (const x of [...s]) {
				if (x instanceof Set && x.size <= 1) {
					s.delete(x)
					for (const p of x) s.add(p)
				}
			}
		}
	}

	return { add, finish, sets }
}

const toRow = (m: Map<string, string>) => new Set<string>([...m].map(([k, v]) => k + "\0" + v))

console.error("collecting states")

const arity: Record<string, number> = {}
const lhsOf: Record<string, string> = {}
const ruleKey: Record<string, string> = {} // "lhs: RHS SYMBOLS" as written in gram.y (semantic action key)
for (const r of toArr(xml?.["bison-xml-report"]?.["grammar"]?.["rules"]?.["rule"])) {
	arity[r["@number"]] = toArr(r.rhs.symbol).length
	lhsOf[r["@number"]] = fixCase(r.lhs)
	ruleKey[r["@number"]] = `${r.lhs}:${toArr(r.rhs.symbol)
		.map(x => " " + x)
		.join("")}`
}

/**
 * Semantic actions (track B typing, #55): a dialect with `actions.ts` gets the rule key as a third element of every
 * reduce action (`[pops, nonterminal, "lhs: RHS"]`), which the value-carrying driver (`Parse` in src/gram/driver.ts) looks
 * up in the dialect's action table. Unit rules that have an action (a key `"lhs: X":` in actions.ts) are never collapsed
 * into a unit chain, because a chain keeps the value of the top of the stack as it is.
 */
const actionsFile = dialectDir + "/actions.ts"
const withKeys = existsSync(actionsFile)
const actionKeys = new Set(
	withKeys ? [...(await readFile(actionsFile, "utf8")).matchAll(/^\s*"([^"\n]+:[^"\n]*)":/gm)].map(m => m[1]!) : [],
)

const shiftOf = new Map<number, Map<string, number>>()
const gotoOf = new Map<number, Map<string, number>>()
const reduceOf = new Map<number, Map<string, string>>() // symbol (or "$default") -> rule number or "accept"
const preds = new Map<number, Set<number>>()
const stateNumbers: number[] = []

for (const s of toArr(xml?.["bison-xml-report"]?.["automaton"]?.["state"])) {
	const n = Number(s["@number"])
	stateNumbers.push(n)
	const sh = new Map<string, number>()
	const gt = new Map<string, number>()
	for (const t of toArr(s?.["actions"]?.["transitions"]?.["transition"])) {
		const to = Number(t["@state"])
		;(t["@type"] === "shift" ? sh : gt).set(fixCase(t["@symbol"]), to)
		if (!preds.has(to)) preds.set(to, new Set())
		preds.get(to)!.add(n)
	}
	const rd = new Map<string, string>()
	for (const t of toArr(s?.["actions"]?.["reductions"]?.["reduction"])) {
		if (t["@enabled"] === "true") rd.set(fixCase(t["@symbol"]), t["@rule"])
	}
	if (sh.size) shiftOf.set(n, sh)
	if (gt.size) gotoOf.set(n, gt)
	if (rd.size) reduceOf.set(n, rd)
}

/**
 * Unit-rule chains: a state whose only action is the default reduction of a one-symbol rule (`a_expr: c_expr .`) does not
 * depend on the lookahead and leaves the states below untouched, so the whole run of such reductions that follows
 * (a_expr -> ... -> Iconst) is a function of the state below: `chain[q][p]` = the state the run ends in, with `p` below.
 * The driver replaces q by it in one step.
 */
const chainRule = (q: number): string | null => {
	if (shiftOf.has(q)) return null
	const rd = reduceOf.get(q)
	if (!rd || rd.size !== 1) return null
	const rule = rd.get("$default")
	if (rule === undefined || rule === "accept" || arity[rule] !== 1 || actionKeys.has(ruleKey[rule]!)) return null
	return rule
}
const chainEnd = (q: number, p: number, seen = new Set<number>()): number => {
	const rule = chainRule(q)
	if (rule === null || seen.has(q)) return q
	seen.add(q)
	const next = gotoOf.get(p)?.get(lhsOf[rule]!)
	return next === undefined ? q : chainEnd(next, p, seen)
}

// reduce actions are shared aliases `R<k> = [[unknown, ...], "lhs"]` (the pops, the nonterminal to go to)
const reduceAliases = new Map<string, string>()
const reduceAlias = (rule: string): string => {
	const pops = `[${new Array(arity[rule]).fill("unknown").join(", ")}]`
	const text = `[${pops}, ${JSON.stringify(lhsOf[rule])}${withKeys ? ", " + JSON.stringify(ruleKey[rule]) : ""}]`
	if (!reduceAliases.has(text)) reduceAliases.set(text, "R" + reduceAliases.size)
	return reduceAliases.get(text)!
}

const actionSharer = makeSharer()
const gotoSharer = makeSharer()
const chainSharer = makeSharer()
const chainRows = new Map<number, SuperSet<string>>()
const actionRows = new Map<number, SuperSet<string>>()
const gotoRows = new Map<number, SuperSet<string>>()
let chainEntries = 0

console.error("building rows")

for (const n of stateNumbers) {
	const row = new Map<string, string>()
	for (const [tok, to] of shiftOf.get(n) ?? []) row.set(tok, String(to))
	const chain = chainRule(n)
	if (chain !== null) {
		const m = new Map<string, string>()
		for (const p of preds.get(n) ?? []) {
			chainEntries++
			m.set(String(p), String(chainEnd(n, p)))
		}
		const set = chainSharer.add(toRow(m))
		chainRows.set(n, set)
		row.set("$default", `C${n}`)
	} else {
		for (const [sym, rule] of reduceOf.get(n) ?? [])
			row.set(sym, rule === "accept" ? '"accept"' : reduceAlias(rule))
	}
	if (row.size) actionRows.set(n, actionSharer.add(toRow(row)))
	const g = gotoOf.get(n)
	if (g?.size) gotoRows.set(n, gotoSharer.add(toRow(new Map([...g].map(([k, v]) => [k, String(v)])))))
}
actionSharer.finish()
gotoSharer.finish()
chainSharer.finish()
console.error(`chain entries: ${chainEntries}, reduce aliases: ${reduceAliases.size}, action keys: ${actionKeys.size}`)
for (const k of actionKeys) if (!Object.values(ruleKey).includes(k)) never(`actions.ts: no rule ${JSON.stringify(k)}`)

const key = (k: string) => (/^([A-Za-z_$][\w$]*|\d+)$/.test(k) ? k : JSON.stringify(k))

function emit(
	prefix: string,
	sharer: ReturnType<typeof makeSharer>,
	rows: Map<number, SuperSet<string>>,
	onlyDecls = false,
) {
	const subsets = new Set(
		sharer.sets
			.values()
			.flatMap(s => s)
			.filter(s => s instanceof Set),
	)
	const names = new Map<SuperSet<string>, string>([...subsets].map((s, i) => [s, `${prefix}T${i + 1}`]))
	const body = (s: SuperSet<string>) => {
		const own = [...s].filter(x => typeof x === "string").map(x => x.split("\0") as [string, string])
		const parents = [...s]
			.filter(x => typeof x !== "string")
			.map(x => names.get(x as SuperSet<string>) ?? never("unnamed part"))
		return { own: own.map(([k, v]) => `${key(k)}: ${v}`).join("\n"), parents }
	}
	const decls: string[] = []
	const iface = (name: string, s: SuperSet<string>) => {
		const { own, parents } = body(s)
		decls.push(`interface ${name}${parents.length ? " extends " + parents.join(", ") : ""} {\n${own}\n}`)
	}
	for (const s of subsets) iface(names.get(s)!, s)
	const members: string[] = []
	for (const [n, s] of rows) {
		if (names.has(s)) {
			if (onlyDecls) decls.push(`type ${prefix}${n} = ${names.get(s)}`)
			members.push(`${n}: ${names.get(s)}`)
		} else if (!onlyDecls && s.values().every(x => typeof x === "string")) {
			members.push(`${n}: {${body(s).own.replaceAll("\n", ", ")}}`)
		} else {
			iface(`${prefix}${n}`, s)
			members.push(`${n}: ${prefix}${n}`)
		}
	}
	return { decls: decls.join("\n"), table: `{\n${members.join("\n")}\n}` }
}

const A = emit("A", actionSharer, actionRows)
const G = emit("G", gotoSharer, gotoRows)
const C = emit("C", chainSharer, chainRows, true)

// lemon %fallback (lemon2bison.mjs): { terminal: fallback terminal }, emitted as `Fallback` for the driver
const fallbackFile = dialectDir + "/fallback.json"
const fallback: Record<string, string> = existsSync(fallbackFile)
	? JSON.parse(await readFile(fallbackFile, "utf8"))
	: {}
const hasFallback = Object.keys(fallback).length > 0

console.log("writing file")

await writeFile(
	dialectDir + "/tables.d.ts",
	`// GENERATED by scripts/gram/xml2ts.ts (npm run gram:generate) - do not edit.
// LALR(1) automaton as types, read by src/gram/driver.ts. A .d.ts on purpose: skipLibCheck then skips checking it
// (and "export {}" keeps the helper types out of the module's exports, which the checker would otherwise all resolve).
//   Actions[state][terminal]: a number = shift to that state; R<k> = [pops, nonterminal(, rule key)] = reduce; "accept";
//     \`$default\` = what other terminals do (a reduce, or an object { stateBelow: state } = a collapsed run of unit reductions).
//   Gotos[state][nonterminal]: the state to go to after a reduction.

export type Actions = ${A.table}

export type Gotos = ${G.table}

${
	hasFallback
		? `export type Fallback = {\n${Object.entries(fallback)
				.map(([k, v]) => `${key(k)}: ${JSON.stringify(v)}`)
				.join("\n")}\n}\n\n`
		: ""
}export type Tables = { Actions: Actions; Gotos: Gotos${hasFallback ? "; Fallback: Fallback" : ""} }

export {}

${[...reduceAliases].map(([text, name]) => `type ${name} = ${text}`).join("\n")}

${A.decls}

${G.decls}

${C.decls}
`,
)

console.error("finishing")

function fixCase(s: string) {
	return /^'[^']+'$/.test(s) ? s.slice(1, -1) : s === s.toUpperCase() ? s.toLowerCase() : s
}

function never(msg = "never"): never {
	throw new Error(msg)
}
