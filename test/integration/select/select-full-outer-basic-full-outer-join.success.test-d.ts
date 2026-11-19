// Integration Test: SELECT with FULL OUTER JOIN - Basic FULL OUTER JOIN
// Integration Test: FULL OUTER JOIN
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()
// ✅ SUCCESS: Basic FULL OUTER JOIN

const _result = await _db.query(
	`select users.name, orders.total from users full outer join orders on users.id = orders.user_id;`,
)

expectType<typeof _result>(toBe<{ name: string | null; total: number | null }[]>())
