// RUN-16: postgresSqlDriver.stream reads through a server-side cursor in batches of pageSize (default 50), one row at a time.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { postgresSqlDriver } from "../../src/postgres/index.ts"

function fakeClient(total: number) {
	const log = { sizes: [] as number[], fetched: 0, args: [] as unknown[][] }
	const sql = Object.assign((): undefined => undefined, {
		options: { parsers: {} },
		unsafe: (...args: unknown[]) => {
			log.args.push(args)
			return {
				cursor: (size: number) => {
					log.sizes.push(size)
					return (async function* () {
						for (let i = 0; i < total; i += size) {
							const batch = []
							for (let j = i; j < Math.min(i + size, total); j++) {
								batch.push({ n: j })
							}
							log.fetched++
							yield batch
						}
					})()
				},
			}
		},
	}) as unknown as ReturnType<typeof postgres>
	return { sql, log }
}

describe("RUN-16 postgresSqlDriver.stream", () => {
	it("RUN-16: default batch size is 50 and rows come one by one, lazily", async () => {
		const { sql, log } = fakeClient(120)
		const it = (await postgresSqlDriver({ sql }).stream!(`select n from t`))[Symbol.asyncIterator]()
		assert.deepEqual(await it.next(), { done: false, value: { n: 0 } })
		assert.deepEqual(log.sizes, [50])
		assert.equal(log.fetched, 1)
		for (let i = 1; i < 50; i++) {
			await it.next()
		}
		assert.equal(log.fetched, 1)
		assert.deepEqual(await it.next(), { done: false, value: { n: 50 } })
		assert.equal(log.fetched, 2)
		let rest = 0
		while (!(await it.next()).done) {
			rest++
		}
		assert.equal(rest, 69)
	})
	it("RUN-16: pageSize sets the cursor batch size and all rows are yielded in order", async () => {
		const { sql, log } = fakeClient(7)
		const rows = await Array.fromAsync(await postgresSqlDriver({ sql, pageSize: 3 }).stream!(`select n from t`))
		assert.deepEqual(log.sizes, [3])
		assert.equal(log.fetched, 3)
		assert.deepEqual(
			rows,
			[0, 1, 2, 3, 4, 5, 6].map(n => ({ n })),
		)
	})
	it("RUN-16: params are bound before the cursor is opened", async () => {
		const { sql, log } = fakeClient(1)
		await Array.fromAsync(await postgresSqlDriver({ sql }).stream!(`select n from t where a = :a`, { a: 5 }))
		assert.deepEqual(log.args, [[`select n from t where a = $1`, [5]]])
	})
})
