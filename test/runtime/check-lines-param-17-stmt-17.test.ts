// PARAM-17 (runtime half), STMT-17: queryUntyped rejects a missing parameter; SQL text reaches the driver and the migration source byte for byte.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type postgres from "postgres"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../src/postgres/index.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

describe("PARAM-17 queryUntyped, runtime half", () => {
	it("PARAM-17: `:nope` missing from the object rejects with 'Missing SQL parameter :nope'", async () => {
		const sql = Object.assign((): undefined => undefined, {
			options: { parsers: {} },
			unsafe: () => Promise.resolve([]),
		}) as unknown as ReturnType<typeof postgres>
		const db = sqlMigrations({ driver: postgresSqlDriver({ sql }) })
			.apply(`create table users (id text not null, age integer not null);`)
			.database()
		await assert.rejects(
			db.queryUntyped("select * from users where id = :nope", { id: "a" }),
			/Missing SQL parameter :nope/,
		)
	})
})

describe("STMT-17 SQL text is kept byte for byte", () => {
	it("STMT-17: the driver receives the exact query string; migrations[0].source is the exact apply text", async () => {
		const seen: string[] = []
		const driver = createDriver<MockDriverConfig>({
			query: async sql => {
				seen.push(sql)
				return []
			},
		})
		const migrationText = "create   table users (id integer not null);  -- x"
		const db = sqlMigrations({ driver }).apply(migrationText).database()
		const queryText = "-- c\nSELECT  id\tFROM users;"
		await db.query(queryText)
		assert.deepEqual(seen, [queryText])
		assert.equal(db.migrations[0]?.source, migrationText)
	})
})
