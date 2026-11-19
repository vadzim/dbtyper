// RUN-12: stream() calls the driver's stream as a method, so a class-based driver that uses `this` works.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

class ClassDriver {
	rows = [{ a: 1 }, { a: 2 }]
	async query(_sql: string): Promise<Array<unknown>> {
		return this.rows
	}
	async stream(_sql: string): Promise<AsyncIterable<unknown>> {
		const rows = this.rows
		return (async function* () {
			yield* rows
		})()
	}
}

describe("RUN-12 class-based driver", () => {
	it("RUN-12: stream() keeps `this` of the driver", async () => {
		const db = sqlMigrations({
			driver: createDriver<MockDriverConfig>(new ClassDriver()),
		}).database() as unknown as {
			stream(sql: string): Promise<AsyncIterable<unknown>>
			query(sql: string): Promise<unknown[]>
		}
		const got: unknown[] = []
		for await (const row of await db.stream("select 1")) {
			got.push(row)
		}
		assert.deepEqual(got, [{ a: 1 }, { a: 2 }])
		assert.deepEqual(await db.query("select 1"), [{ a: 1 }, { a: 2 }])
	})
})
