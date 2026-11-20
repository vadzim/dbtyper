// Integration Test: CORE-10 Check: join ... on with and/like
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-10
const _result = await _db.query(`select u.id from users u join posts p on p.user_id = u.id and p.title like 'a%'`)

expectType<typeof _result>(toBe<{ id: number }[]>())
