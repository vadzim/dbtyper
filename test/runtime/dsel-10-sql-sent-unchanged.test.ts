// DSEL-10: dbtyper never translates SQL between dialects; the driver gets the text the user wrote.
import { describe, it } from "node:test"
import assert from "node:assert"
import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"

type SqliteConfig = { dialect: "sqlite"; scalarTypes: { integer: number; text: string }; syntax: "named-params" }

describe("DSEL-10 SQL is sent unchanged", () => {
	it("DSEL-10 passes query, stream and untyped text to the driver as written", async () => {
		const sent: string[] = []
		const driver = createDriver<SqliteConfig>({
			query: async sql => {
				sent.push(sql)
				return []
			},
		})
		const db = sqlMigrations({ driver }).apply(`create table t (id integer not null);`).database()
		await db.query(`select id from t where id = :id`, { id: 1 })
		await Array.fromAsync(await db.stream(`select   id from t`))
		await db.queryUntyped(`select id::text from t`)
		assert.deepStrictEqual(sent, [
			`select id from t where id = :id`,
			`select   id from t`,
			`select id::text from t`,
		])
	})
})
