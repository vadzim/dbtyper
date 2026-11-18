// SQLT-1…SQLT-5, SQLT-54, DSEL-2: both SQLite drivers run against a real in-process SQLite; no Docker.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { describe, test } from "node:test"

import type { SqlDriver } from "../../src/core/sql-database.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { usesNumberedParams } from "../../src/sqlite/sqlite-sql-driver.ts"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => {
	prepare(sql: string): unknown
	exec(sql: string): void
}

const schema = `create table users (id integer primary key, name text not null, email text, score real, avatar blob);
insert into users (id, name, email, score, avatar) values (1, 'ann', null, 1.5, x'0a1b'), (2, 'bob', 'b@x', 2, null)`

type Make = (bigint: boolean) => SqlDriver<never>

function better(bigint: boolean) {
	const db = new BetterSqlite3(":memory:")
	db.exec(schema)
	return betterSqlite3Driver(db, bigint ? { bigint: true } : undefined) as unknown as SqlDriver<never>
}
function nodeSqlite(bigint: boolean) {
	const db = new DatabaseSync(":memory:")
	db.exec(schema)
	return nodeSqliteDriver(db, bigint ? { bigint: true } : undefined) as unknown as SqlDriver<never>
}

const drivers: Array<[string, Make]> = [
	["betterSqlite3Driver", better],
	["nodeSqliteDriver", nodeSqlite],
]

for (const [name, make] of drivers) {
	describe(name, () => {
		test("SQLT-3, SQLT-54: storage classes come back as number, string, Uint8Array, null", async () => {
			const rows = (await make(false).query(
				"select id, name, score, avatar, email from users order by id",
			)) as Array<Record<string, unknown>>
			assert.equal(rows.length, 2)
			const [a, b] = rows as [Record<string, unknown>, Record<string, unknown>]
			assert.equal(typeof a.id, "number")
			assert.equal(typeof a.name, "string")
			assert.equal(typeof a.score, "number")
			assert.ok(a.avatar instanceof Uint8Array)
			assert.deepEqual([...(a.avatar as Uint8Array)], [0x0a, 0x1b])
			assert.equal(a.email, null)
			assert.equal(b.avatar, null)
			assert.equal(typeof b.score, "number") // REAL column holding 2 stays number
		})

		test("SQLT-4, SQLT-54: bigint mode types every INTEGER as bigint, REAL stays number", async () => {
			const [row] = (await make(true).query("select id, score, name from users where id = 1")) as Array<
				Record<string, unknown>
			>
			assert.equal(row?.id, 1n)
			assert.equal(typeof row?.score, "number")
			assert.equal(row?.name, "ann")
		})

		test("SQLT-4: bigint mode keeps values beyond 2^53", async () => {
			const [row] = (await make(true).query("select 9007199254740993 as big")) as Array<Record<string, unknown>>
			assert.equal(row?.big, 9007199254740993n)
		})

		test("SQLT-30, SQLT-32: positional ?, ?NNN and named :n/@n/$n parameters bind; bigint and Uint8Array bind", async () => {
			const d = make(false)
			assert.equal(((await d.query("select name from users where id = ?", [2])) as any[])[0].name, "bob")
			assert.equal(
				((await d.query("select name from users where id = ?1 or score > ?2 order by id", [1, 1.8])) as any[])
					.length,
				2,
			)
			assert.equal(((await d.query("select name from users where id = @id", { id: 1 })) as any[])[0].name, "ann")
			assert.equal(((await d.query("select name from users where id = :id", { id: 2n })) as any[])[0].name, "bob")
			assert.equal(((await d.query("select name from users where id = $id", { id: 1 })) as any[])[0].name, "ann")
			assert.equal(
				((await d.query("select id from users where avatar = ?", [new Uint8Array([0x0a, 0x1b])])) as any[])[0]
					.id,
				1,
			)
			assert.equal(((await d.query("select id from users where email is ?", [null])) as any[])[0].id, 1)
		})

		test("SQLT-5: query returns a promise of rows (also for non-row statements), stream an async iterable", async () => {
			const d = make(false)
			const p = d.query("select id from users order by id")
			assert.ok(p instanceof Promise)
			assert.deepEqual(await d.query("update users set email = :e where id = :id", { e: "z", id: 1 }), [])
			assert.equal(((await d.query("select email from users where id = 1")) as any[])[0].email, "z")
			const seen: unknown[] = []
			const it = await d.stream!("select id, name from users order by id")
			assert.equal(typeof it[Symbol.asyncIterator], "function")
			for await (const row of it) {
				seen.push(row)
			}
			assert.equal(seen.length, 2)
			assert.equal((seen[1] as any).name, "bob")
			const returning = await d.query("insert into users (name) values (?) returning id", ["cy"])
			assert.equal((returning as any[])[0].id, 3)
		})
	})
}

test("DSEL-2: dbtyper/sqlite entry does not import the postgres package", async () => {
	const { readFile } = await import("node:fs/promises")
	for (const f of ["index.ts", "sqlite-sql-driver.ts", "sqlite-type-map.ts"]) {
		const src = await readFile(new URL(`../../src/sqlite/${f}`, import.meta.url), "utf8")
		assert.doesNotMatch(src, /from "postgres"|postgres\//)
	}
})

describe("usesNumberedParams (SQLT-30, #65)", () => {
	test("is decided from the SQL text: ?NNN outside strings, names and comments only", () => {
		assert.equal(usesNumberedParams("select ?1, ?2"), true)
		assert.equal(usesNumberedParams("select ? from t"), false)
		assert.equal(usesNumberedParams("select '?1', \"?2\" from t where a = ?"), false)
		assert.equal(usesNumberedParams("select 1 -- ?1\n, ?"), false)
		assert.equal(usesNumberedParams("select a /* ?1 */ from t where b = ?3"), true)
	})

	// The lexer's rules for text that hides a ?NNN (src/lexer/sql-lexer.ts): quote doubling, the three quoted-name
	// forms, X'..' blobs, line and block comments (also over several lines), and a quote inside another kind of text.
	test("follows the lexer: where a ?NNN is hidden and where it is not", () => {
		const hidden = [
			"select 'it''s ?1' from t",
			'select "a""?1" from t',
			"select `?1` from t",
			"select [?1] from t",
			"select X'3F31', '?1'",
			"select 1 /* line one\n ?1 \n line three */",
			"select 1 -- it's ?1",
			'select "it\'s" , ?',
			"select '\"', ?",
		]
		for (const sql of hidden) {
			assert.equal(usesNumberedParams(sql), false, sql)
		}
		const visible = [
			"select 'a' || ?1",
			"select 'it''s', ?2",
			'select "x" = ?10',
			"select 1 /* c */ + ?1",
			"select ?1 -- c",
		]
		for (const sql of visible) {
			assert.equal(usesNumberedParams(sql), true, sql)
		}
	})
})

describe("SQLT-1: version floor", () => {
	test("SQLT-1: package.json declares Node >= 22.13 and a better-sqlite3 >= 11 peer range", async () => {
		const { readFile } = await import("node:fs/promises")
		const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as {
			engines?: { node?: string }
			peerDependencies?: Record<string, string>
		}
		assert.equal(pkg.engines?.node, ">=22.13")
		assert.equal(pkg.peerDependencies?.["better-sqlite3"], ">=11.0.0")
	})

	test("SQLT-1: node:sqlite (the Node floor) is available at the running Node version", () => {
		const [major = 0, minor = 0] = process.versions.node.split(".").map(Number)
		assert.ok(
			major > 22 || (major === 22 && minor >= 13),
			`Node ${process.versions.node} is below the SQLT-1 floor`,
		)
		assert.equal(typeof DatabaseSync, "function")
	})
})

describe("SQLT-2, SQLT-4: the driver switches the real driver to big-integer mode", () => {
	test("SQLT-2, SQLT-4: betterSqlite3Driver calls safeIntegers(true) with { bigint: true }, safeIntegers(false) otherwise", async () => {
		for (const bigint of [true, false]) {
			const calls: boolean[] = []
			const stmt = {
				reader: true,
				safeIntegers: (on?: boolean) => void calls.push(on as boolean),
				all: () => [],
				iterate: () => [],
				run: () => ({}),
			}
			const driver = betterSqlite3Driver({ prepare: () => stmt }, bigint ? { bigint: true } : undefined)
			await (driver as unknown as SqlDriver<never>).query("select 1")
			assert.deepEqual(calls, [bigint])
		}
	})

	test("SQLT-2, SQLT-4: nodeSqliteDriver calls setReadBigInts(true) with { bigint: true }, setReadBigInts(false) otherwise", async () => {
		for (const bigint of [true, false]) {
			const calls: boolean[] = []
			const stmt = {
				setReadBigInts: (on: boolean) => void calls.push(on),
				all: () => [],
				iterate: () => [],
				run: () => ({}),
			}
			const driver = nodeSqliteDriver({ prepare: () => stmt }, bigint ? { bigint: true } : undefined)
			await (driver as unknown as SqlDriver<never>).query("select 1")
			assert.deepEqual(calls, [bigint])
		}
	})
})
