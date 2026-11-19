// RUN-12, RUN-13, PARAM-17: stream falls back to driver.query; queryUntyped/streamUntyped run like query/stream.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

describe("stream without driver.stream (RUN-12)", () => {
	it("RUN-12: yields the rows of driver.query one by one", async () => {
		const driver = createDriver<MockDriverConfig>({ query: async () => [{ id: "1" }, { id: "2" }] })
		const db = sqlMigrations({ driver }).apply(`create table users (id text);`).database()
		const it = (await db.stream(`select id from users;`))[Symbol.asyncIterator]()
		assert.deepEqual(await it.next(), { done: false, value: { id: "1" } })
		assert.deepEqual(await it.next(), { done: false, value: { id: "2" } })
		assert.equal((await it.next()).done, true)
	})
	it("RUN-12: a non-array query result rejects with the 3501 text", async () => {
		const driver = createDriver<MockDriverConfig>({ query: async () => undefined as never })
		const db = sqlMigrations({ driver }).apply(`create table users (id text);`).database()
		await assert.rejects(
			db.stream(`select id from users;`),
			/stream\(\) requires a row-returning statement \(SELECT or RETURNING clause\)/,
		)
	})
})

describe("untyped escape hatch (RUN-13, PARAM-17)", () => {
	function setup() {
		const calls: Array<{ kind: string; sql: string; params: unknown }> = []
		const driver = createDriver<MockDriverConfig>({
			query: async (sql, params) => {
				calls.push({ kind: "query", sql, params })
				return [{ a: 1 }]
			},
			stream: async (sql, params) => {
				calls.push({ kind: "stream", sql, params })
				return (async function* () {
					yield { a: 1 }
					yield { a: 2 }
				})()
			},
		})
		return { calls, db: sqlMigrations({ driver }).database() }
	}
	it("RUN-13: queryUntyped passes any string and params to driver.query", async () => {
		const { calls, db } = setup()
		const sql = `select * from users tablesample system (10);`
		const rows: any[] = await db.queryUntyped(sql, { x: 1 })
		assert.deepEqual(rows, [{ a: 1 }])
		assert.deepEqual(calls, [{ kind: "query", sql, params: { x: 1 } }])
	})
	it("RUN-13: streamUntyped passes any string and params to driver.stream", async () => {
		const { calls, db } = setup()
		const rows: any[] = await Array.fromAsync(await db.streamUntyped(`not even sql :x`, { x: 1 }))
		assert.deepEqual(rows, [{ a: 1 }, { a: 2 }])
		assert.deepEqual(calls, [{ kind: "stream", sql: `not even sql :x`, params: { x: 1 } }])
	})
	it("PARAM-17: untyped params are an object only (type level)", () => {
		const { db } = setup()
		// @ts-expect-error arrays are not accepted
		void db.queryUntyped(`select ?`, [1])
		// @ts-expect-error arrays are not accepted
		void db.streamUntyped(`select ?`, [1])
	})
})
