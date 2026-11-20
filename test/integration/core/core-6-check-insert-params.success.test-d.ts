// Integration Test: CORE-6 Check: insert params { n: string; e: string | null } accepted
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null default 0, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-6
const _result = await _db.query(`insert into users (name, email) values (:n, :e)`, { n: "a", e: null })

expectType<typeof _result>(toBe<[]>())
