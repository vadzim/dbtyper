// Integration Test: CORE-3 Check: max(id) is number | null, count(*) non-null
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-3
const _result = await _db.query(`select max(id) as m, count(*) as c from users`)

expectType<typeof _result>(toBe<{ m: number | null; c: string }[]>())
