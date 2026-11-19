// Integration Test: SELECT - CORE-12 WITH RECURSIVE: nullable if the recursive part makes it so
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-12
const _result = await _db.query(
	`with recursive t as (select id, name from users union all select id, null as name from t) select id, name from t;`,
)

expectType<typeof _result>(toBe<{ id: number; name: string | null }[]>())
