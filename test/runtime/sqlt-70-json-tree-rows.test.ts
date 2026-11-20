// Check SQLT-70 against both real SQLite drivers: the rows of `json_tree` fit the types of SQLT-69 (number mode) and
// are bigint in big-integer mode. The type side: test/sqlite/sqlt-69-72-json-each.test-d.ts.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { describe, test } from "node:test"

import { sqlMigrations } from "../../src/core/sql-database.ts"
import { betterSqlite3Driver, nodeSqliteDriver } from "../../src/sqlite/index.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type BetterSqlite3Database from "better-sqlite3"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => BetterSqlite3Database.Database

type JsonType = "null" | "true" | "false" | "integer" | "real" | "text" | "array" | "object"

const query = `select key, value, type, atom, id, parent, fullkey, path from json_tree(?)` as const
const doc = '[1,{"x":true}]'

/** The rows of the Check, without `id` (a number the engine picks) and with `path` only where the Check gives it. */
const expected = [
	{ key: null, value: doc, type: "array", atom: null, parent: null, fullkey: "$", path: "$" },
	{ key: 0, value: 1, type: "integer", atom: 1, parent: 0, fullkey: "$[0]" },
	{ key: 1, value: '{"x":true}', type: "object", atom: null, fullkey: "$[1]" },
	{ key: "x", value: 1, type: "true", atom: 1, fullkey: "$[1].x", path: "$[1]" },
]

function checkRows(rows: readonly Record<string, unknown>[], big: boolean) {
	assert.equal(rows.length, expected.length)
	const toBig = (v: unknown) => (big && typeof v === "number" ? BigInt(v) : v)
	for (const [i, want] of expected.entries()) {
		const row = rows[i]!
		assert.equal(typeof row.id, big ? "bigint" : "number")
		for (const [k, v] of Object.entries(want)) {
			assert.deepEqual(row[k], toBig(v), `row ${i} ${k}`)
		}
	}
}

const engines = [
	[
		"betterSqlite3Driver",
		() => betterSqlite3Driver(new BetterSqlite3(":memory:")),
		() => betterSqlite3Driver(new BetterSqlite3(":memory:"), { bigint: true }),
	],
	[
		"nodeSqliteDriver",
		() => nodeSqliteDriver(new DatabaseSync(":memory:")),
		() => nodeSqliteDriver(new DatabaseSync(":memory:"), { bigint: true }),
	],
] as const

describe("SQLT-70: json_tree rows", () => {
	for (const [name, makeNumber, makeBig] of engines) {
		test(`${name}: number mode`, async () => {
			const db = sqlMigrations({ driver: makeNumber() }).database()
			const rows = await db.query(query, [doc])
			expectType<typeof rows>(
				toBe<
					Array<{
						key: number | string | null
						value: number | string | null
						type: JsonType
						atom: number | string | null
						id: number
						parent: number | null
						fullkey: string
						path: string
					}>
				>(),
			)
			checkRows(rows, false)
			const types: JsonType[] = rows.map(r => r.type)
			assert.deepEqual(types, ["array", "integer", "object", "true"])
		})

		test(`${name}: big-integer mode`, async () => {
			const db = sqlMigrations({ driver: makeBig() }).database()
			const rows = await db.query(query, [doc])
			expectType<typeof rows>(
				toBe<
					Array<{
						key: bigint | string | null
						value: bigint | number | string | null
						type: JsonType
						atom: bigint | number | string | null
						id: bigint
						parent: bigint | null
						fullkey: string
						path: string
					}>
				>(),
			)
			checkRows(rows, true)
		})
	}
})
