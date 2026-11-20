// Integration Test: SELECT - SEL-18 RIGHT JOIN to a CTE without an alias keeps the CTE columns and makes the left side nullable (#152)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS
const _result = await _db.query(
	`with p as (select user_id, title from posts) select u.id, p.title from users u right join p on p.user_id = u.id;`,
)

expectType<typeof _result>(toBe<{ id: number | null; title: string }[]>())
