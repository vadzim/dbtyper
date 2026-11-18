// Integration Test: SELECT - SEL-8 unaliased aggregate is named by the function name
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.apply(`create table orders (id integer not null, user_id integer not null, total integer not null);`)
	.database()

// ✅ SUCCESS: SEL-8 unaliased aggregate is named by the function name
const _result = await _db.query(`select count(*) from users;`)

expectType<typeof _result>(toBe<{ count: bigint }[]>())
