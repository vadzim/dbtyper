// Integration Test: SELECT - SEL-2 an output alias without AS
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS
const _result = await _db.query(`select id i, name n from users;`)

expectType<typeof _result>(toBe<{ i: number; n: string | null }[]>())
