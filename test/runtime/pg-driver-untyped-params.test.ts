// PARAM-5, PARAM-6, PARAM-14, PARAM-15, PARAM-16, PARAM-17: parameters through postgresSqlDriver with a fake client.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"

function setup() {
	const sent: unknown[][] = []
	const sql = Object.assign((): undefined => undefined, {
		options: { parsers: {} },
		unsafe: (...args: unknown[]) => {
			sent.push(args)
			return Promise.resolve([{ id: "a" }])
		},
	}) as unknown as ReturnType<typeof postgres>
	const driver = postgresSqlDriver({ sql })
	const db = sqlMigrations({ driver })
		.apply(`create schema public;`)
		.apply(`create table users (id text not null, age integer);`)
		.database()
	return { sent, db, driver }
}

describe("postgres driver parameters at runtime", () => {
	it("PARAM-15: queryUntyped sends each :name as $n with the values; unused keys are not sent (PARAM-14)", async () => {
		const { sent, db } = setup()
		const rows = await db.queryUntyped(`select * from users where id = :id or id = :id and age > :age`, {
			age: 3,
			id: "a",
			extra: 1,
		})
		assert.deepEqual(rows, [{ id: "a" }])
		assert.deepEqual(sent, [[`select * from users where id = $1 or id = $1 and age > $2`, ["a", 3]]])
	})
	it("PARAM-6: '::' and ':x' inside a string are never parameters", async () => {
		const { sent, db } = setup()
		await db.query(`select * from users where id = ':x' and age = :a::integer;`, { a: 1 })
		assert.deepEqual(sent, [[`select * from users where id = ':x' and age = $1::integer;`, [1]]])
	})
	it("PARAM-14: extra array elements are accepted for $n", async () => {
		// (typed query() rejects unused elements with dbtyper:2405, see the BUG skip file for PARAM-14; the driver itself accepts them)
		const { sent, driver } = setup()
		await driver.query(`select * from users where id = $1;`, ["a", "unused"])
		assert.deepEqual(sent, [[`select * from users where id = $1;`, ["a", "unused"]]])
	})
	it("PARAM-5: the driver itself would rewrite ? at runtime, but the compile check rejects it", async () => {
		const { sent, db } = setup()
		// @ts-expect-error `?` is not accepted by postgresSqlDriver (dbtyper:1007)
		await db.query(`select * from users where id = ?;`, ["a"])
		assert.deepEqual(sent, [[`select * from users where id = $1;`, ["a"]]])
	})
	it("PARAM-16: a missing :name rejects before anything is sent", async () => {
		const { sent, db } = setup()
		await assert.rejects(db.queryUntyped(`select :a`, {}), /Missing SQL parameter :a/)
		assert.deepEqual(sent, [])
	})
	it("PARAM-16: fewer array elements than ? rejects before anything is sent", async () => {
		const { sent, db } = setup()
		// @ts-expect-error `?` is not accepted by postgresSqlDriver
		await assert.rejects(db.query(`select ?, ?`, [1]), /Not enough parameters/)
		assert.deepEqual(sent, [])
	})
})
