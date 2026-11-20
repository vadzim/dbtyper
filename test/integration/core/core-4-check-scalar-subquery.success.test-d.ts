// Integration Test: CORE-4 Check: scalar subquery is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-4
const _result = await _db.query(`select (select id from users) as s from users`)

expectType<typeof _result>(toBe<{ s: number | null }[]>())
