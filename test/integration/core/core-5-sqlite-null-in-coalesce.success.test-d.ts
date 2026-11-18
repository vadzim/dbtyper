// Integration Test: CORE-5: NULL in COALESCE follows CORE-2
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-5: NULL in COALESCE follows CORE-2
const _result = await _db.query(`select coalesce(null, name) as a, coalesce(null, email) as b from users;`)

expectType<typeof _result>(toBe<{ a: string; b: string | null }[]>())
