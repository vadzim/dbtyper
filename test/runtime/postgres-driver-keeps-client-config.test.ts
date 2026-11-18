import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { postgresSqlDriver } from "../../src/postgres/index.ts"

describe("postgresSqlDriver", () => {
	it("PGT-3: never changes the parsers of the user's postgres client", () => {
		const parsers: Record<number, unknown> = {}
		const sql = Object.assign(() => undefined, { options: { parsers } }) as unknown as ReturnType<typeof postgres>
		postgresSqlDriver({ sql })
		postgresSqlDriver({ sql, bigint: true })
		assert.deepEqual(parsers, {})
	})
})

describe("postgresSqlDriver positional params", () => {
	async function sent(text: string, params: unknown[]): Promise<{ text: string; values: readonly unknown[] }> {
		let seen: { text: string; values: readonly unknown[] } | undefined
		const sql = Object.assign((): undefined => undefined, {
			unsafe: (t: string, v: readonly unknown[]) => {
				seen = { text: t, values: v }
				return Promise.resolve([])
			},
			options: { parsers: {} },
		}) as unknown as ReturnType<typeof postgres>
		await postgresSqlDriver({ sql }).query(text, params)
		assert.ok(seen)
		return seen
	}

	it("PARAM-15: a $1 query with '?' in a string or comment keeps its values", async () => {
		const r = await sent(`select '?' as q, "a?b" from t where id = $1 -- why?\n/* ? */`, [7])
		assert.deepEqual(r.values, [7])
		assert.match(r.text, /\$1/)
	})

	it("PARAM-15: real ? tokens are rewritten", async () => {
		const r = await sent(`select '?' from t where a = ? and b = ?`, [1, 2])
		assert.equal(r.text, `select '?' from t where a = $1 and b = $2`)
		assert.deepEqual(r.values, [1, 2])
	})
})
