import { readFile, writeFile } from "node:fs/promises"

// usage: node scripts/gram/xml2ts.ts <dialect dir>   (reads <dir>/gram.xml, writes <dir>/tables.ts)
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

const shifts: Record<number, SuperSet<string>> = {}
const reductions: Record<number, SuperSet<string>> = {}
const gotos: Record<number, SuperSet<string>> = {}

const rules: Record<
	number,
	{
		item: string
		args: string[]
	}
> = {}

const sets = new Array<SuperSet<string>>()

const appendItems = <T>(s: Set<T>, i: Set<T>) => {
	for (const p of i) s.add(p)
}

const removeItems = <T>(s: Set<T>, i: Set<T>) => {
	for (const p of i) s.delete(p)
}

const replaceItems = <T>(s: Set<T>, i: Set<T>, j: T) => {
	removeItems(s, i)
	s.add(j)
}

const getSetSize = (s: SuperSet<string>): number => {
	if (sizes.has(s)) {
		return sizes.get(s) ?? 0
	}
	const size = s
		.values()
		.map(x => (typeof x === "string" ? 1 : getSetSize(x)))
		.reduce((a, b) => a + b, 0)
	sizes.set(s, size)
	return size
}

const sizes = new WeakMap<SuperSet<string>, number>()

const addSet = (s: SuperSet<string>): SuperSet<string> => {
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

const obj2set = (p: Record<string, number>) => addSet(new Set(Object.entries(p).map(([k, v]) => k + "\0" + v)))

console.error("Building shifts")

for (const s of toArr(xml?.["bison-xml-report"]?.["automaton"]?.["state"])) {
	// console.error(sets.length)
	const g = toArr(s?.["actions"]?.["transitions"]?.["transition"])
		.filter(t => t["@type"] === "shift")
		.map(t => [fixCase(t["@symbol"]), t["@state"]] as const)
	if (g.length) {
		shifts[s["@number"]] = obj2set(Object.fromEntries(g))
	}
}

console.error("Building reductions")

for (const s of toArr(xml?.["bison-xml-report"]?.["automaton"]?.["state"])) {
	// console.error(sets.length)
	const g = toArr(s?.["actions"]?.["reductions"]?.["reduction"])
		.filter(t => t["@enabled"] === "true")
		.map(t => [fixCase(t["@symbol"]), t["@rule"]] as const)
	if (g.length) {
		reductions[s["@number"]] = obj2set(Object.fromEntries(g))
	}
}

console.error("Building gotos")

for (const s of toArr(xml?.["bison-xml-report"]?.["automaton"]?.["state"])) {
	// console.error(sets.length)
	const g = toArr(s?.["actions"]?.["transitions"]?.["transition"])
		.filter(t => t["@type"] === "goto")
		.map(t => [fixCase(t["@symbol"]), t["@state"]] as const)
	if (g.length) {
		gotos[s["@number"]] = obj2set(Object.fromEntries(g))
	}
}

console.error("Building rules")

for (const r of toArr(xml?.["bison-xml-report"]?.["grammar"]?.["rules"]?.["rule"])) {
	rules[r["@number"]] = {
		item: r.lhs,
		args: toArr(r.rhs.symbol).map(fixCase),
	}
}

for (const s of sets) {
	for (const x of [...s]) {
		if (x instanceof Set && x.size <= 1) {
			s.delete(x)
			appendItems(s, x)
		}
	}
}

const stringify = (data: unknown) => JSON.stringify(data).replaceAll(/"(\d+)"/g, "$1")

const set2text = (s: SuperSet<string>) => {
	const text = []
	const own = s
		.values()
		.filter(x => typeof x === "string")
		.map(x => x.split("\0"))
		.toArray()
	if (own.length > 0) text.push(stringify(Object.fromEntries(own)))
	text.push(
		...s
			.values()
			.filter(x => typeof x !== "string")
			.map(x => names.get(x) ?? ""),
	)
	return text.join(" & ")
}

const subsets = new Set(
	sets
		.values()
		.flatMap(s => s)
		.filter(s => s instanceof Set),
)

const names = new WeakMap<SuperSet<string>, string>(subsets.values().map((s, i) => [s, `T${i + 1}`]))

const stringifyRefs = (refs: Record<number, SuperSet<string>>) =>
	"{" +
	Object.entries(refs)
		.map(([k, v]) => k + ": " + (subsets.has(v) ? names.get(v) : set2text(v)))
		.join("\n") +
	"}"

const Shifts = stringifyRefs(shifts)
const Reductions = stringifyRefs(reductions)
const Gotos = stringifyRefs(gotos)
const Rules = stringify(rules)

console.log("writing file")

await writeFile(
	dialectDir + "/tables.ts",
	`
// Shifts ${Shifts.length}
// Reductions ${Reductions.length}
// Gotos ${Gotos.length}
// Rules ${Rules.length}

export type Shifts = ${Shifts}

export type Reductions = ${Reductions}

export type Gotos = ${Gotos}

export type Rules = ${Rules}

export type Tables = { Shifts: Shifts; Reductions: Reductions; Gotos: Gotos; Rules: Rules }

${subsets
	.values()
	.map(s => "type " + names.get(s) + " = " + set2text(s))
	.toArray()
	.join("\n\n")}`,
)

console.error("finishing")

function fixCase(s: string) {
	return /^'[^']+'$/.test(s) ? s.slice(1, -1) : s === s.toUpperCase() ? s.toLowerCase() : s
}

function never(msg = "never"): never {
	throw new Error(msg)
}
