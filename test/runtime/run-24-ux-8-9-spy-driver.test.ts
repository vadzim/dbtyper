// RUN-24, UX-8 (no SQL run), UX-9 (SQL byte for byte): a spy driver behind sqlMigrations(...).database().
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

const schema = `create table users (id text not null, name text not null);`

function spyDriver(onCall?: (n: number) => void) {
	const calls: Array<{ sql: string; params: unknown }> = []
	const driver = createDriver<MockDriverConfig>({
		query: async (sql, params) => {
			calls.push({ sql, params })
			onCall?.(calls.length)
			return []
		},
	})
	return { driver, calls }
}

describe("RUN-24 database objects send every call to the driver", () => {
	it("RUN-24: two database() objects of one chain send query, stream, queryUntyped, streamUntyped to the driver, 4 calls each", async () => {
		const { driver, calls } = spyDriver()
		const chain = sqlMigrations({ driver }).apply(schema)
		const one = chain.database()
		const two = chain.database()
		assert.equal(calls.length, 0, "no call before the first db.query")
		for (const db of [one, two]) {
			const before: number = calls.length
			await db.query(`select id from users;`)
			await Array.fromAsync(await db.stream(`select id from users;`))
			await db.queryUntyped(`select id from users;`)
			await Array.fromAsync(await db.streamUntyped(`select id from users;`))
			assert.equal(calls.length - before, 4)
		}
		assert.equal(calls.length, 8)
	})
	it("RUN-24: a driver that throws on its next call makes the next db.query reject with that error; nothing is cached or retried", async () => {
		let boom: Error | undefined
		const calls: string[] = []
		const driver = createDriver<MockDriverConfig>({
			query: async sql => {
				calls.push(sql)
				if (boom !== undefined) throw boom
				return []
			},
		})
		const db = sqlMigrations({ driver }).apply(schema).database()
		assert.deepEqual(calls, [])
		await db.query(`select id from users;`)
		boom = new Error("driver down")
		await assert.rejects(db.query(`select id from users;`), err => err === boom)
		assert.equal(calls.length, 2, "one call per db.query: no retry")
		boom = undefined
		await db.query(`select id from users;`)
		assert.equal(calls.length, 3, "the failure was not cached")
	})
})

describe("UX-8 no SQL is run for typing", () => {
	it("UX-8: building chains A and B and their database objects never calls the driver", () => {
		const { driver, calls } = spyDriver()
		const a = sqlMigrations({ driver }).apply(`create table users (id integer not null, name text not null)`)
		const b = a.apply(`alter table users drop column name`)
		a.database()
		b.database()
		assert.equal(calls.length, 0)
	})
})

describe("UX-9 SQL goes to the driver byte for byte", () => {
	it("UX-9: spy driver gets `select  id FROM users where id = :id` unchanged and { id: 1 }", async () => {
		const { driver, calls } = spyDriver()
		const db = sqlMigrations({ driver })
			.apply(`create table users (id integer not null, name text not null)`)
			.database()
		await db.query(`select  id FROM users where id = :id`, { id: 1 })
		assert.deepEqual(calls, [{ sql: `select  id FROM users where id = :id`, params: { id: 1 } }])
	})
	it("UX-9: postgresSqlDriver turns only :name into $n; comments and spacing stay identical", async () => {
		const sent: unknown[][] = []
		const sql = Object.assign((): undefined => undefined, {
			options: { parsers: {} },
			unsafe: (...args: unknown[]) => {
				sent.push(args)
				return Promise.resolve([])
			},
		}) as unknown as ReturnType<typeof postgres>
		const db = sqlMigrations({ driver: postgresSqlDriver({ sql }) })
			.apply(`create table users (id integer not null, name text not null)`)
			.database()
		const text = `select  id /* the id */ FROM users\t-- trailing\n where  id = :id  and name = 'a:b'  ;\n`
		await db.query(text, { id: 1 })
		assert.deepEqual(sent, [[text.replace(":id", "$1"), [1]]])
	})
})
