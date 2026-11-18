// Integration Test: CORE-1: a PRIMARY KEY column of a STRICT SQLite table is NOT NULL (SQLT-14)
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(`create table k (code text primary key) strict;`)
	.database()

// ✅ SUCCESS: CORE-1: a PRIMARY KEY column of a STRICT SQLite table is NOT NULL (SQLT-14)
const _result = await _db.query(`select code from k;`)

expectType<typeof _result>(toBe<{ code: string }[]>())
