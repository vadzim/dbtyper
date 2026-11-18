// Integration Test: CORE-1: a table-level PRIMARY KEY of a WITHOUT ROWID SQLite table makes its columns NOT NULL (SQLT-14)
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(`create table m (a text, b integer, c text, primary key (a, b)) without rowid;`)
	.database()

// ✅ SUCCESS: CORE-1: a table-level PRIMARY KEY of a WITHOUT ROWID SQLite table makes its columns NOT NULL (SQLT-14)
const _result = await _db.query(`select a, b, c from m;`)

expectType<typeof _result>(toBe<{ a: string; b: number; c: string | null }[]>())
