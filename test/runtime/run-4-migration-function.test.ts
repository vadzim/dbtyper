// RUN-4: migration(sql) returns its argument unchanged; a plain .js migration module works with TEST_MIGRATIONS set.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createDriver, migration, sqlMigrations } from "../../src/core/sql-database.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

const mockDriver = createDriver<MockDriverConfig>({ query: async () => [] })

describe("RUN-4 migration()", () => {
	it("RUN-4: called from a .js module it returns the same string", async () => {
		const mod = (await import("./migration-modules/002.do.users.js")) as { generateSql: () => string }
		assert.equal(mod.generateSql(), `create table auth.users (id text not null, age integer);`)
	})
	it("RUN-4: the SQL from a .js module is applied as is", async () => {
		const mod = (await import("./migration-modules/002.do.users.js")) as { generateSql: () => string }
		const db = sqlMigrations({ driver: mockDriver })
			.apply(`create schema auth;`)
			.apply(mod.generateSql(), "002")
			.database()
		assert.deepEqual(db.migrations[1], { source: mod.generateSql(), path: "002" })
	})
	it("RUN-4: with TEST_MIGRATIONS set, a call from a non-.js module throws", () => {
		if (!process.env.TEST_MIGRATIONS) {
			return
		}
		assert.throws(() => migration(`select 1`), /should be called from a JavaScript file/)
	})
})
