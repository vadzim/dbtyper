// Integration Test: SELECT - SEL-28 GROUP BY key may be an expression
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-28 GROUP BY key may be an expression
const _result = await _db.query(`select lower(name) as l from users group by lower(name);`)

expectType<typeof _result>(toBe<{ l: string }[]>())
