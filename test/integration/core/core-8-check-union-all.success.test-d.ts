// Integration Test: CORE-8 Check: union all of id,name with id,title
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-8
const _result = await _db.query(`select id, name from users union all select id, title from posts`)

expectType<typeof _result>(toBe<{ id: number; name: string | null }[]>())
