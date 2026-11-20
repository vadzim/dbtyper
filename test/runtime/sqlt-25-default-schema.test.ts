import test from "node:test"
import assert from "node:assert/strict"
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { createDriver } from "../../src/core/sql-driver.ts"

type SqliteConfig = { dialect: "sqlite"; scalarTypes: { integer: number }; syntax: "named-params" }
const pgDriver = createDriver<{ dialect: "postgres"; scalarTypes: { integer: number }; syntax: "named-params" }>({
	query: async () => [],
})
const sqliteDriver = createDriver<SqliteConfig>({ defaultSchema: "main", query: async () => [] })

test("SQLT-25: a SQLite defaultSchema other than main / temp throws", () => {
	assert.throws(() => sqlMigrations({ driver: sqliteDriver, defaultSchema: "app" } as never), /SQLite has no schemas/)
	assert.equal(sqlMigrations({ driver: sqliteDriver }).getDefaultSchema(), "main")
	assert.equal(sqlMigrations({ driver: sqliteDriver, defaultSchema: "temp" }).getDefaultSchema(), "temp")
	assert.equal(sqlMigrations({ driver: pgDriver, defaultSchema: "app" }).getDefaultSchema(), "app")
})
