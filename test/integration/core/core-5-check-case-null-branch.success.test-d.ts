// Integration Test: CORE-5 Check: case with a null branch is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-5
const _result = await _db.query(`select case when id = 1 then null else name end as c from users`)

expectType<typeof _result>(toBe<{ c: string | null }[]>())
