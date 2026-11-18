// Integration Test: CORE-2: arithmetic with a nullable operand is nullable
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-2: arithmetic with a nullable operand is nullable
const _result = await _db.query(`select score + 1 as s, id * 2 as d from posts;`)

expectType<typeof _result>(toBe<{ s: number | null; d: number }[]>())
