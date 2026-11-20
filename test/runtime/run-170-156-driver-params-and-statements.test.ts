// #170 (PARAM-14): the drivers leave out values the SQL does not read; #156 / RUN-12: stream of a statement without rows
// rejects on every driver; RUN-3: the default schema of a SQLite chain is `main`; the binder edge cases of #175.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { describe, test } from "node:test"
import type postgres from "postgres"

import { sqlMigrations, type SqlDriver } from "../../src/core/sql-database.ts"
import { bindColonNamedParamsForPg } from "../../src/postgres/bind-colon-named-params-for-pg.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => { prepare(sql: string): unknown }

/** node:sqlite rows have a null prototype. */
const plain = (rows: unknown[]) => rows.map(row => ({ ...(row as object) }))

const drivers: Array<[string, () => SqlDriver<never>]> = [
	["betterSqlite3Driver", () => betterSqlite3Driver(new BetterSqlite3(":memory:")) as unknown as SqlDriver<never>],
	["nodeSqliteDriver", () => nodeSqliteDriver(new DatabaseSync(":memory:")) as unknown as SqlDriver<never>],
]

for (const [name, make] of drivers) {
	describe(`${name}: surplus parameters, stream, default schema`, () => {
		test("PARAM-14: surplus positional values are left out, also for a text without parameters", async () => {
			const d = make()
			assert.deepEqual(plain(await d.query("select ? as a", [1, 2, 3])), [{ a: 1 }])
			assert.deepEqual(plain(await d.query("select ?2 as a, ?1 as b", [1, 2, 3])), [{ a: 2, b: 1 }])
			assert.deepEqual(plain(await d.query("select 1 as a", [1])), [{ a: 1 }])
			assert.deepEqual(plain(await d.query("select '?' as a, ? as b -- ?", [1, 2])), [{ a: "?", b: 1 }])
		})
		test("PARAM-14: surplus named keys are left out", async () => {
			const d = make()
			assert.deepEqual(plain(await d.query("select :a as a, @b as b", { a: 1, b: 2, c: 3 })), [{ a: 1, b: 2 }])
			assert.deepEqual(plain(await d.query("select 1 as a", { a: 1 })), [{ a: 1 }])
		})
		test("RUN-12: stream of a statement without rows rejects", async () => {
			const d = make()
			await assert.rejects(d.stream!("create table t (id integer)"), /requires a row-returning/)
			assert.deepEqual(plain(await Array.fromAsync(await d.stream!("select 1 as a"))), [{ a: 1 }])
		})
		test("RUN-3: the default schema of a SQLite chain is main, a given one wins", () => {
			assert.equal(sqlMigrations({ driver: make() } as never).database().defaultSchema, "main")
			assert.equal(
				sqlMigrations({ driver: make(), defaultSchema: "temp" } as never).database().defaultSchema,
				"temp",
			)
		})
	})
}

describe("PostgreSQL driver: surplus parameters, default schema, binder edge cases", () => {
	function recording() {
		const calls: unknown[][] = []
		const sql = Object.assign((): undefined => undefined, {
			options: { parsers: {} },
			unsafe: (...args: unknown[]) => {
				calls.push(args)
				return Object.assign(Promise.resolve([]), {
					describe: async () => ({ columns: [{}] }),
					cursor: () => [],
				})
			},
		}) as unknown as ReturnType<typeof postgres>
		return { sql, calls }
	}
	test("PARAM-14: values above the highest $n are left out", async () => {
		const { sql, calls } = recording()
		const d = postgresSqlDriver({ sql })
		await d.query("select $1, $2", [1, 2, 3])
		await d.query("select '$3', $1 -- $4", [1, 2])
		await d.query("select 1", [1])
		assert.deepEqual(calls, [["select $1, $2", [1, 2]], ["select '$3', $1 -- $4", [1]], ["select 1"]])
	})
	test("RUN-3: the PostgreSQL default schema is public", () => {
		assert.equal(
			sqlMigrations({ driver: postgresSqlDriver({ sql: recording().sql }) }).database().defaultSchema,
			"public",
		)
	})
	test("`:toString` with {} is a missing parameter, not a prototype function", () => {
		assert.throws(() => bindColonNamedParamsForPg("select :toString", {}), /Missing SQL parameter :toString/)
	})
	test("E'…' strings: a backslash-escaped quote does not end the string", () => {
		const sql = String.raw`select E'it\'s :x', e'a\\' , :y`
		assert.deepEqual(bindColonNamedParamsForPg(sql, { y: 1 }), { text: sql.replace(":y", "$1"), values: [1] })
		assert.deepEqual(bindColonNamedParamsForPg(`select 'a\\' , :y`, { y: 1 }).values, [1]) // plain string: no escape
	})
	test("array slices: `arr[lo:hi]` has no parameter", () => {
		assert.deepEqual(bindColonNamedParamsForPg("select arr[lo:hi], arr[1:2], :p from t", { p: 5 }).values, [5])
	})
})
