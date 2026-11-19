// Integration Test: SEL-7 unaliased literal is keyed ?column?
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: SEL-7 unaliased literal is keyed ?column?
const _result = await _db.query(`select 1 from users;`)

expectType<typeof _result>(toBe<{ "?column?": number }[]>())
