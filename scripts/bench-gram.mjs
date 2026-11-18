// Benchmark of the type-level LR driver (#95, #22): `npm run gram:bench [-- --compiler tsgo|tsc --reps 5 --sizes 50,100,...]`.
// Feeds `Recognize<Tables, [...terminals]>` (terminals written as a tuple literal, so the lexer is not measured) to the
// compiler for statements of growing length, reads `--extendedDiagnostics`, and prints per size the MEDIAN of the runs
// (check time, instantiations, memory) or the first error (TS2589 = instantiation too deep). Prints `uptime` before and
// after: numbers from a loaded machine are not comparable. Run it under `flock ~/.cache/dbtyper-heavy.lock`.
//   fixed load  = median check time of a 4-token statement (table load + one tiny parse)
//   ms/token    = least-squares slope of median check time over the sizes that passed
import { spawnSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

const arg = (name, def) => {
	const i = process.argv.indexOf("--" + name)
	return i >= 0 ? process.argv[i + 1] : def
}
const root = resolve(import.meta.dirname, "..")
const compiler = arg("compiler", "tsgo")
const reps = Number(arg("reps", "5"))
const dialect = arg("dialect", "postgres")
const tablesFile = arg("tables", "tables.d.ts")
const sizes = arg("sizes", "100,200,400,800,1000,1500,2000,4000").split(",").map(Number)
const work = resolve(tmpdir(), `dbtyper-bench-gram-${process.pid}`)
mkdirSync(work, { recursive: true })
writeFileSync(resolve(work, "package.json"), '{"type":"module"}')

/** `select a + 1 , b + 1 , ... , z from t`: 1 + 4k + 1 + 2 tokens; padded to exactly n with trailing `, ident` pairs is not needed. */
function terminals(n) {
	const k = Math.max(0, Math.floor((n - 4) / 4))
	const t = ["select"]
	// SQLite: terminal names of parse.y, and the statement ends with `semi`
	const sq = dialect === "sqlite"
	for (let i = 0; i < k; i++) t.push(sq ? "id" : "ident", sq ? "plus" : "+", sq ? "integer" : "iconst", sq ? "comma" : ",")
	t.push(sq ? "id" : "ident", "from", sq ? "id" : "ident")
	if (sq) t.push("semi")
	return t
}

function runOnce(n) {
	const ts = terminals(n)
	const file = resolve(work, `case-${n}.ts`)
	writeFileSync(
		file,
		`import type { Recognize } from ${JSON.stringify(resolve(root, "src/gram/driver.ts"))}
import type { Tables } from ${JSON.stringify(resolve(root, "src/gram", dialect, tablesFile))}
type R = Recognize<Tables, [${ts.map(x => JSON.stringify(x)).join(", ")}]>
export const ok: true = null as unknown as (R extends { ok: true } ? true : R)
`,
	)
	writeFileSync(
		resolve(work, "tsconfig.json"),
		JSON.stringify({
			extends: resolve(root, "tsconfig.json"),
			include: [file],
			exclude: [],
			compilerOptions: { types: [], noEmit: true },
		}),
	)
	const bin = resolve(root, "node_modules/.bin", compiler)
	// bash `time` reports the CPU time (user + sys) of the compiler, which a loaded machine distorts far less than the wall clock
	const r = spawnSync(
		"bash",
		[
			"-c",
			`TIMEFORMAT='cpu %U %S'; time "$0" "$@"`,
			bin,
			"--noEmit",
			"-p",
			resolve(work, "tsconfig.json"),
			"--extendedDiagnostics",
		],
		{ encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, LC_ALL: "C" } },
	)
	const out = (r.stdout ?? "") + (r.stderr ?? "")
	const num = re => Number(out.match(re)?.[1] ?? NaN)
	const err = out.match(/error (TS\d+)/)?.[1] ?? null
	return {
		tokens: ts.length,
		err,
		check: num(/Check time:\s+([\d.]+)s/) * 1000,
		inst: num(/Instantiations:\s+(\d+)/),
		memMB: num(/Memory used:\s+(\d+)K/) / 1024,
		cpu: (num(/cpu ([\d.]+) /) + num(/cpu [\d.]+ ([\d.]+)/)) * 1000,
	}
}

const median = xs => {
	const s = [...xs].sort((a, b) => a - b)
	return s[Math.floor(s.length / 2)]
}
const uptime = () => spawnSync("uptime", { encoding: "utf8" }).stdout.trim()

console.log(`# bench-gram: ${compiler}, dialect ${dialect}, ${reps} runs per size, median`)
console.log(`# uptime before: ${uptime()}`)
const rows = []
for (const n of [4, ...sizes]) {
	const runs = Array.from({ length: reps }, () => runOnce(n))
	const bad = runs.find(r => r.err)
	if (bad) {
		console.log(`${String(bad.tokens).padStart(6)} tokens: ${bad.err}`)
		rows.push({ tokens: bad.tokens, err: bad.err })
		break
	}
	const row = {
		tokens: runs[0].tokens,
		check: median(runs.map(r => r.check)),
		min: Math.min(...runs.map(r => r.check)),
		cpu: median(runs.map(r => r.cpu)),
		inst: median(runs.map(r => r.inst)),
		memMB: median(runs.map(r => r.memMB)),
	}
	rows.push(row)
	console.log(
		`${String(row.tokens).padStart(6)} tokens: check ${row.check.toFixed(0)} ms (min ${row.min.toFixed(0)}), cpu ${row.cpu.toFixed(0)} ms, inst ${row.inst}, mem ${row.memMB.toFixed(0)} MB`,
	)
}
const ok = rows.filter(r => !r.err)
const pts = ok.slice(1)
const slope = key => {
	if (pts.length < 2) return NaN
	const mx = pts.reduce((a, r) => a + r.tokens, 0) / pts.length
	const my = pts.reduce((a, r) => a + r[key], 0) / pts.length
	return (
		pts.reduce((a, r) => a + (r.tokens - mx) * (r[key] - my), 0) / pts.reduce((a, r) => a + (r.tokens - mx) ** 2, 0)
	)
}
const failed = rows.find(r => r.err)
console.log(`fixed load (4 tokens): check ${ok[0]?.check.toFixed(0)} ms wall, ${ok[0]?.cpu.toFixed(0)} ms cpu`)
console.log(
	`ms/token (slope over ${pts.map(p => p.tokens).join(",")}): check ${slope("check").toFixed(2)} wall, ${slope("cpu").toFixed(2)} cpu, ${slope("inst").toFixed(0)} instantiations`,
)
console.log(
	`max tokens passed: ${ok.at(-1)?.tokens}${failed ? `; ${failed.err} at ${failed.tokens}` : " (no failure up to the largest size)"}`,
)
console.log(`# uptime after: ${uptime()}`)
rmSync(work, { recursive: true, force: true })
