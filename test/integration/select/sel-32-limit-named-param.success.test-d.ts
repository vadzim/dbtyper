// Integration Test: SEL-32 LIMIT with a named parameter
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-32 LIMIT with a named parameter
const _result = await _db.query(`select * from users limit :n;`, { n: 5 })

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
