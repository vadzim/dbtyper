// Integration Test: CORE-2: CASE is nullable when a branch is
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-2: CASE is nullable when a branch is
const _result = await _db.query(`select case when id > 1 then name else email end as c from users;`)

expectType<typeof _result>(toBe<{ c: string | null }[]>())
