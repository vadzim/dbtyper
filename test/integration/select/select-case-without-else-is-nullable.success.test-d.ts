// Integration Test: EXPR-21: CASE without ELSE is nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null, email text, active boolean not null);`)
	.database()

// ✅ SUCCESS: EXPR-21: CASE without ELSE is nullable

const _result = await _db.query(`select name, case when active then 'yes' end as is_active from users;`)

expectType<typeof _result>(toBe<{ name: string; is_active: string | null }[]>())
