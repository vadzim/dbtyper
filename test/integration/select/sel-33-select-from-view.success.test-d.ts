// Integration Test: SEL-33 select from a view
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.apply(`create view big as select orders.id, orders.total from orders;`)
	.database()

// ✅ SUCCESS: SEL-33 select from a view
const _result = await _db.query(`select * from big;`)

expectType<typeof _result>(toBe<{ id: number; total: number }[]>())
