// Integration Test: SELECT - CORE-12 WITH RECURSIVE with a join in the recursive part
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS: CORE-12
const _result = await _db.query(
	`with recursive t as (select id, 1 as depth from users union all select u.id, t.depth + 1 as depth from t join users u on u.id = t.id) select id, depth from t;`,
)

expectType<typeof _result>(toBe<{ id: number; depth: number }[]>())
