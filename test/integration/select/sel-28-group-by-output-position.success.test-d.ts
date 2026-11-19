// Integration Test: SELECT - SEL-28 GROUP BY key may be an output-column position
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-28 GROUP BY key may be an output-column position
const _result = await _db.query(`select id, count(*) as c from users group by 1;`)

expectType<typeof _result>(toBe<{ id: number; c: string }[]>())
