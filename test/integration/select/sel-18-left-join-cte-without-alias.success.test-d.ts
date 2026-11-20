// Integration Test: SELECT - SEL-18 LEFT JOIN to a CTE without an alias makes its columns nullable (#152)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS
const _result = await _db.query(
	`with p as (select user_id, title from posts) select p.title from users u left join p on p.user_id = u.id;`,
)

expectType<typeof _result>(toBe<{ title: string | null }[]>())
