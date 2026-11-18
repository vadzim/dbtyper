// Integration Test: CORE-3: sum and avg are nullable (SQLT-47 result types)
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-3: sum and avg are nullable (SQLT-47 result types)
const _result = await _db.query(`select sum(user_id) as s, avg(user_id) as a, sum(score) as r from posts;`)

expectType<typeof _result>(toBe<{ s: number | null; a: number | null; r: number | null }[]>())
