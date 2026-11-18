// Integration Test: CORE-2: operators propagate NULL, COALESCE with a non-null argument and IS NULL are non-null
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-2: operators propagate NULL, COALESCE with a non-null argument and IS NULL are non-null
const _result = await _db.query(`select email || '!' as e, coalesce(email, '') as f, email is null as g from users;`)

expectType<typeof _result>(toBe<{ e: string | null; f: string; g: number }[]>())
