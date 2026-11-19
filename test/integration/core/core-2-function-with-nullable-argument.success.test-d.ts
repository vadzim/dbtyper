// Integration Test: CORE-2: a function of a nullable argument is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null, email text);`)
	.database()

// ✅ SUCCESS: CORE-2: a function of a nullable argument is nullable
const _result = await _db.query(`select upper(email) as u, upper(name) as v from users;`)

expectType<typeof _result>(toBe<{ u: string | null; v: string }[]>())
