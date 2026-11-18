// Converts a lemon grammar (SQLite's src/parse.y) into a bison grammar: `node scripts/gram/lemon2bison.mjs <dialect dir>`
//   <dir>/parse.y  ->  <dir>/gram.y (bison input)  +  <dir>/fallback.json (lemon %fallback as { terminal: fallbackTerminal })
//   <dir>/mkkeywordhash.c -> <dir>/keywords.ts (keyword text -> terminal name; only keywords whose terminal the grammar uses)
// Run by `npm run gram:generate` (scripts/gram-generate.mjs) when the dialect directory has a parse.y. See src/gram/README.md.
//
// What is converted:
//   - actions `{...}`, `%include`, `%type`, `%destructor`, `%name` ... and aliases `X(A)` are dropped; `::=` -> `:`.
//   - `%ifdef/%ifndef/%if/%else/%endif` are evaluated with DEFINED below (lemon -D flags; no SQLITE_OMIT_* = everything on).
//   - `%left/%right/%nonassoc` -> bison. A rule's precedence in lemon is the FIRST terminal with a precedence in its
//     right-hand side (yacc/bison: the last), so every rule gets an explicit `%prec` (or its `[TOKEN]` mark).
//   - Reduce/reduce conflicts: lemon prefers the rule with the higher precedence, bison the earlier rule. Rules of one
//     nonterminal that have a precedence are reordered (stable, higher first, within the slots they occupy) so that both agree.
//   - `%token_class` and `A|B` multi-terminals in a right-hand side: the rule is repeated for each member.
//   - `%wildcard ANY`: ANY becomes the nonterminal `any_token` = every terminal except those with explicit actions where
//     ANY is used (LP, RP, COMMA: the virtual-table argument list).
//   - `%fallback ID A B C .`: written to fallback.json; the driver tries the fallback terminal when a state has no action.
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const DEFINED = new Set(["SQLITE_UDL_CAPABLE_PARSER"]) // UPDATE/DELETE ... ORDER BY/LIMIT are part of the syntax
// bison reports 62 reduce/reduce conflicts after the reordering below (silenced by gram-generate.mjs; %expect-rr is GLR only): `x IS NOT expr` vs `NOT expr` (50) and
// `expr BETWEEN expr AND expr` vs `expr AND expr` (12); both are resolved as lemon resolves them (higher precedence rule).
const WILDCARD_EXCLUDE = ["LP", "RP", "COMMA"]

const dir = resolve(process.argv[2] ?? "src/gram/sqlite")
const src = readFileSync(resolve(dir, "parse.y"), "utf8")
const header = src.match(/version-[\d.]+/)?.[0]

// ---- 1. conditional sections (line based; they always start in column 0) ----
const evalCond = expr =>
	Function(`return !!(${expr.replace(/\b[A-Z_][A-Z0-9_]*\b/g, w => (DEFINED.has(w) ? "1" : "0"))})`)()
let text = ""
{
	const stack = [] // { on: boolean, parentOn: boolean, taken: boolean }
	const on = () => stack.every(s => s.on)
	for (const line of src.split("\n")) {
		const m = line.match(/^%(ifdef|ifndef|if|else|endif)\b\s*(.*)$/)
		if (!m) {
			if (on()) text += line + "\n"
			continue
		}
		const [, kind, rest] = m
		if (kind === "endif") stack.pop()
		else if (kind === "else") stack.at(-1).on = !stack.at(-1).on
		else {
			const word = rest.replace(/\/\*.*$/, "").trim()
			stack.push({
				on: kind === "ifdef" ? DEFINED.has(word) : kind === "ifndef" ? !DEFINED.has(word) : evalCond(word),
			})
		}
	}
	if (stack.length) throw new Error("unbalanced %if")
}

// ---- 2. scanner ----
let i = 0
const n = text.length
const rules = [] // { lhs, rhs: string[] (symbols, may contain A|B), prec?: string }
const tokens = [] // order of declaration
const precLevels = [] // { assoc, tokens }
const classes = new Map() // name -> members
const fallback = new Map() // token -> fallback
let wildcard = null
let start = null

function skipWsComments() {
	for (;;) {
		while (i < n && /\s/.test(text[i])) i++
		if (text.startsWith("/*", i)) i = text.indexOf("*/", i) + 2
		else if (text.startsWith("//", i)) i = text.indexOf("\n", i) < 0 ? n : text.indexOf("\n", i)
		else return
	}
}
function skipBlock() {
	// text[i] === "{"
	let depth = 0
	for (; i < n; i++) {
		const c = text[i]
		if (c === "{") depth++
		else if (c === "}") {
			if (--depth === 0) return void i++
		} else if (text.startsWith("/*", i)) i = text.indexOf("*/", i) + 1
		else if (text.startsWith("//", i)) i = text.indexOf("\n", i) - 1
		else if (c === '"' || c === "'") {
			for (i++; text[i] !== c; i++) if (text[i] === "\\") i++
		}
	}
	throw new Error("unterminated block")
}
const word = () => {
	skipWsComments()
	const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i, i + 80))
	if (!m) return null
	i += m[0].length
	return m[0]
}
const isTerminal = s => /^[A-Z]/.test(s)

const BLOCK = new Set([
	"include",
	"type",
	"destructor",
	"syntax_error",
	"stack_overflow",
	"token_type",
	"default_type",
	"extra_context",
	"extra_argument",
	"parse_accept",
	"parse_failure",
	"default_destructor",
	"token_destructor",
])
const LINE = new Set(["name", "stack_size", "stack_size_limit", "token_prefix", "realloc", "free"])
const DOT = new Set(["token", "fallback", "left", "right", "nonassoc", "token_class", "wildcard"])

/** words and `A|B` up to the terminating period */
function untilDot() {
	const out = []
	for (;;) {
		skipWsComments()
		if (text[i] === ".") return (void i++, out)
		if (text[i] === "|") {
			i++
			out.push("|")
			continue
		}
		const w = word()
		if (w === null) throw new Error("bad directive near: " + text.slice(i, i + 60))
		out.push(w)
	}
}

for (;;) {
	skipWsComments()
	if (i >= n) break
	if (text[i] === "%") {
		i++
		const d = word()
		if (BLOCK.has(d)) {
			while (text[i] !== "{") i++
			skipBlock()
		} else if (LINE.has(d)) i = text.indexOf("\n", i)
		else if (DOT.has(d)) {
			const w = untilDot()
			if (d === "token") for (const t of w) tokens.push(t)
			else if (d === "wildcard") wildcard = w[0]
			else if (d === "fallback") for (const t of w.slice(1)) fallback.set(t, w[0])
			else if (d === "token_class") {
				const members = []
				for (const t of w.slice(1)) if (t !== "|") members.push(t)
				classes.set(w[0], members)
			} else precLevels.push({ assoc: d, tokens: w })
		} else throw new Error("unknown directive %" + d)
		continue
	}
	// rule: lhs [(alias)] ::= rhs... .  [ [PREC] ] [ {action} ]
	const lhs = word()
	if (lhs === null) throw new Error("rule expected near: " + text.slice(i, i + 60))
	skipWsComments()
	if (text[i] === "(") i = text.indexOf(")", i) + 1
	skipWsComments()
	if (!text.startsWith("::=", i)) throw new Error(`::= expected after ${lhs} near: ` + text.slice(i, i + 60))
	i += 3
	const rhs = []
	for (;;) {
		skipWsComments()
		if (text[i] === ".") {
			i++
			break
		}
		let sym = word()
		if (sym === null) throw new Error(`bad rhs in ${lhs} near: ` + text.slice(i, i + 60))
		while (text[i] === "|") {
			i++
			sym += "|" + word()
		}
		skipWsComments()
		if (text[i] === "(") i = text.indexOf(")", i) + 1
		rhs.push(sym)
	}
	let prec
	skipWsComments()
	if (text[i] === "[") {
		const e = text.indexOf("]", i)
		prec = text.slice(i + 1, e).trim()
		i = e + 1
	}
	skipWsComments()
	if (text[i] === "{") skipBlock()
	start ??= lhs
	rules.push({ lhs, rhs, prec })
}

// ---- 3. expansion ----
const precOf = new Map()
precLevels.forEach((lv, k) => lv.tokens.forEach(t => precOf.set(t, k)))

const used = new Set() // terminals used in rules (in order of first use)
const nonterminals = new Set(rules.map(r => r.lhs))
const alternatives = sym => {
	if (classes.has(sym)) return classes.get(sym)
	return sym.split("|")
}

const expanded = [] // { lhs, text, level }
let ruleCount = 0
for (const r of rules) {
	let combos = [[]]
	for (const sym of r.rhs) {
		const alts = sym === wildcard ? ["any_token"] : alternatives(sym)
		combos = combos.flatMap(c => alts.map(a => [...c, a]))
	}
	for (const c of combos) {
		for (const s of c) if (isTerminal(s)) used.add(s)
		let prec = r.prec
		if (prec === undefined) prec = c.find(s => precOf.has(s))
		expanded.push({
			lhs: r.lhs,
			text: `${r.lhs}: ${c.join(" ")}${prec ? ` %prec ${prec}` : ""}`,
			level: prec ? precOf.get(prec) : -1,
		})
		ruleCount++
	}
}
// reduce/reduce: see the header; only the slots of rules that carry a precedence are permuted
for (const lhs of nonterminals) {
	const slots = expanded.flatMap((r, k) => (r.lhs === lhs && r.level >= 0 ? [k] : []))
	const sorted = slots.map(k => expanded[k]).sort((a, b) => b.level - a.level)
	slots.forEach((k, j) => (expanded[k] = sorted[j]))
}
const out = expanded.map(r => r.text)
used.delete(wildcard)
const exclude = new Set(WILDCARD_EXCLUDE)
// the wildcard matches every terminal that the grammar knows (declared with %token or used), except the excluded ones
const allTerminals = [...new Set([...used, ...[...fallback.keys()].filter(t => used.has(t))])]
const anyMembers = allTerminals.filter(t => !exclude.has(t))
if (wildcard && !out.some(l => l.includes("any_token"))) throw new Error("wildcard unused")

// ---- 4. write bison ----
const declared = allTerminals.filter(t => !precOf.has(t))
const bison =
	`/* GENERATED by scripts/gram/lemon2bison.mjs from parse.y (${header ?? "SQLite"}); do not edit: edit the converter or re-vendor parse.y. */\n` +
	`/* ${ruleCount} rules from ${rules.length} lemon rules; %fallback is in fallback.json (see src/gram/README.md). */\n` +
	`%start ${start}\n` +
	`%token ${declared.join(" ")}\n` +
	precLevels.map(lv => `%${lv.assoc} ${lv.tokens.join(" ")}`).join("\n") +
	"\n%%\n" +
	out.join(";\n") +
	";\n" +
	(wildcard ? anyMembers.map(t => `any_token: ${t}`).join(";\n") + ";\n" : "") +
	"%%\n"
writeFileSync(resolve(dir, "gram.y"), bison)
console.error(`gram.y: ${ruleCount + (wildcard ? anyMembers.length : 0)} rules, ${allTerminals.length} terminals`)

// fallback: only terminals that exist; lowercase like xml2ts names terminals
const fb = {}
for (const [t, f] of fallback) if (used.has(t) && used.has(f)) fb[t.toLowerCase()] = f.toLowerCase()
writeFileSync(resolve(dir, "fallback.json"), JSON.stringify(fb, null, "\t") + "\n")
console.error(`fallback.json: ${Object.keys(fb).length} entries`)

// ---- 5. keywords (mkkeywordhash.c) ----
const kw = readFileSync(resolve(dir, "mkkeywordhash.c"), "utf8")
const words = {}
for (const m of kw.matchAll(/\{\s*"([A-Z_]+)",\s*"TK_([A-Z_]+)"/g)) {
	if (used.has(m[2])) words[m[1].toLowerCase()] = m[2].toLowerCase()
}
const entries = Object.entries(words).sort(([a], [b]) => (a < b ? -1 : 1))
writeFileSync(
	resolve(dir, "keywords.ts"),
	"// GENERATED by scripts/gram/lemon2bison.mjs from mkkeywordhash.c and parse.y - do not edit.\n" +
		"/** Keyword text (lower case) -> terminal name. Words whose token the grammar does not use are plain identifiers. */\nexport type Keywords = {\n" +
		entries.map(([w, t]) => `\t${JSON.stringify(w)}: ${JSON.stringify(t)}`).join("\n") +
		"\n}\n",
)
console.error(`keywords.ts: ${entries.length} keywords`)
