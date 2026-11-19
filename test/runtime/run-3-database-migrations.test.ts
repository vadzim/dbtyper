// RUN-3: database.migrations lists applied SQL texts in order as { source, path }; database.defaultSchema.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createDriver, sqlMigrations } from "../../src/core/sql-database.ts"
import type { MockDriverConfig } from "../test-utils/test-databases.ts"

const mockDriver = createDriver<MockDriverConfig>({ query: async () => [] })

describe("RUN-3 database.migrations and defaultSchema", () => {
	it("RUN-3: sources unchanged, paths are the names, empty when omitted", () => {
		const a = `create schema app;`
		const b = `  create table  t (id integer);  `
		const db = sqlMigrations({ driver: mockDriver }).apply(a, "001").apply(b).database()
		assert.deepEqual(db.migrations, [
			{ source: a, path: "001" },
			{ source: b, path: "" },
		])
	})
	it("RUN-3: defaultSchema is public unless set", () => {
		assert.equal(sqlMigrations({ driver: mockDriver }).database().defaultSchema, "public")
		assert.equal(sqlMigrations({ driver: mockDriver, defaultSchema: "app" }).database().defaultSchema, "app")
	})
})
