// Integration Test: SELECT - SEL-6 select * with an unused CTE sees a single FROM table
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-6 select * with an unused CTE sees a single FROM table
const _result = await _db.query(`with x as (select id from users) select * from orders;`)

expectType<typeof _result>(toBe<{ id: number; user_id: number; total: number }[]>())
