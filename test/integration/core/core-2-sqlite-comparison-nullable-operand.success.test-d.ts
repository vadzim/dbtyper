// Integration Test: CORE-2: a comparison with a nullable operand is nullable, IS NOT DISTINCT FROM is not
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-2: a comparison with a nullable operand is nullable, IS NOT DISTINCT FROM is not
const _result = await _db.query(
	`select email = 'a' as c, email is not distinct from 'a' as d, id in (1, 2) as i from users;`,
)

expectType<typeof _result>(toBe<{ c: number | null; d: number; i: number }[]>())
