// UX-5, UX-6, UX-8, UX-10 (verification/PRODUCT.md @ 2a941c8): what the user sees from the plain TypeScript compiler.
// The snippets are compiled in memory with the TypeScript API and the repo's tsconfig: no code generator, no plugin.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { compileSnippets, header } from "../test-utils/compile-snippets.ts"

const users = `const db = sqlMigrations({ driver: mockDriver }).apply("create table users (id integer not null, name text not null)").database()\n`
const usersPosts = `const db = sqlMigrations({ driver: mockDriver })
	.apply("create table users (id integer not null, name text not null)")
	.apply("create table posts (id integer not null, user_id integer not null, title text)")
	.database()\n`

const r = compileSnippets({
	ux5: `${header}${users}
const rows = await db.query("select id, name from users")
const bad: { id: string }[] = rows
const ok: { id: number; name: string }[] = rows
`,
	ux6query: `${header}${users}await db.query("select nope from users")\n`,
	ux6stream: `${header}${users}await db.stream("select nope from users")\n`,
	ux6apply: `${header}${users}db.migrations.length
const chain = sqlMigrations({ driver: mockDriver }).apply("create table users (id integer not null)")
chain.apply("create table t as select nope from users")\n`,
	ux6string: `${header}${users}await db.query("select 'abc from users")\n`,
	ux6ident: `${header}${users}await db.query('select "abc from users')\n`,
	ux8: `${header}
const a = sqlMigrations({ driver: mockDriver }).apply("create table users (id integer not null, name text not null)")
const b = a.apply("alter table users drop column name")
const dbA = a.database()
const dbB = b.database()
const rowsA = await dbA.query("select id, name from users")
const rowsB = await dbB.query("select id, name from users")
const nameA = rowsA[0]!.name
const nameB = rowsB[0]!.name
`,
	ux10: `${header}${usersPosts}
const rows = await db.query("select u.id, p.title from users u join posts p on p.user_id = u.id")
const r1: { id: number; title: string | null }[] = rows
declare const plain: { id: number; title: string | null }[]
const r2: typeof rows = plain
`,
})

describe("UX-5 plain tsc, no setup", () => {
	it("UX-5: rows is { id: number; name: string }[]; the wrong annotation fails on its line, the right one compiles", () => {
		const { diagnostics, types } = r.ux5!
		const lines = diagnostics.map(d => d.line)
		const badLine = 1 + 2 + 1 + 1 + 1 // header (2) + users (1) + blank + rows line + bad line
		assert.deepEqual(lines, [badLine], JSON.stringify(diagnostics))
		assert.equal(types.rows, "{ id: number; name: string; }[]")
		assert.equal(types.ok, "{ id: number; name: string; }[]")
	})
	it("UX-5: the package needs no generator, plugin or build step before type-checking", () => {
		const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
			scripts: Record<string, string>
			dependencies?: Record<string, string>
		}
		const tsconfig = readFileSync(new URL("../../tsconfig.json", import.meta.url), "utf8")
		assert.doesNotMatch(tsconfig, /"plugins"/)
		assert.equal(pkg.scripts.typecheck, "tsc --noEmit -p tsconfig.json")
		assert.equal(pkg.dependencies?.typescript, undefined)
	})
})

describe("UX-6 error range is the whole SQL string", () => {
	const wholeArg = (name: string, text: string, message: RegExp) => {
		const d = r[name]!.diagnostics
		assert.equal(d.length, 1, JSON.stringify(d))
		assert.equal(d[0]!.text, text)
		assert.match(d[0]!.message, message)
	}
	it("UX-6: db.query: range = the string argument, message error [dbtyper:2300]: Unknown column nope", () => {
		wholeArg("ux6query", `"select nope from users"`, /error \[dbtyper:2300\]: Unknown column nope/)
	})
	it("UX-6: db.stream: range = the string argument", () => {
		wholeArg("ux6stream", `"select nope from users"`, /error \[dbtyper:2300\]: Unknown column nope/)
	})
	it("UX-6: .apply(create table t as select nope ...): range = the apply argument", () => {
		wholeArg(
			"ux6apply",
			`"create table t as select nope from users"`,
			/error \[dbtyper:2300\]: Unknown column nope/,
		)
	})
	it("UX-6: unclosed string literal is dbtyper:1002", () => {
		wholeArg("ux6string", `"select 'abc from users"`, /\[dbtyper:1002\]: Unclosed string literal/)
	})
	it("UX-6: unclosed quoted identifier is dbtyper:1001", () => {
		wholeArg("ux6ident", `'select "abc from users'`, /\[dbtyper:1001\]: Unclosed quoted identifier literal/)
	})
})

describe("UX-8 the types follow the chain", () => {
	it("UX-8: A types { id: number; name: string }[], B gives dbtyper:2300 Unknown column name; rows[0].name only breaks on B", () => {
		const { diagnostics, types } = r.ux8!
		assert.equal(types.rowsA, "{ id: number; name: string; }[]")
		const byLine = diagnostics.map(d => `${d.line}:${d.text}`)
		assert.equal(diagnostics.length, 2, JSON.stringify(diagnostics))
		const [q, n] = diagnostics as [(typeof diagnostics)[number], (typeof diagnostics)[number]]
		assert.equal(q.text, `"select id, name from users"`, byLine.join())
		assert.match(q.message, /\[dbtyper:2300\]: Unknown column name/)
		// the line over B's rows does not compile (the rows are the error, so the error sits on `rowsB[0]`), over A's it does
		assert.equal(n.line, 11, `nameB line: ${n.line}`)
		assert.equal(
			diagnostics.some(d => d.text.includes("nameA")),
			false,
		)
	})
})

describe("UX-10 plain result object types", () => {
	it("UX-10: hover shows { id: number; title: string | null }[], no Omit, Pick, & or mapped wrapper; both assignments compile", () => {
		const { diagnostics, types } = r.ux10!
		assert.deepEqual(diagnostics, [])
		assert.equal(types.rows, "{ id: number; title: string | null; }[]")
		assert.doesNotMatch(types.rows!, /Omit|Pick|&|\[K in/)
	})
})
