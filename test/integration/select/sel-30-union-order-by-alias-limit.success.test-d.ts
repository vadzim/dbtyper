// Integration Test: SELECT - SEL-31 ORDER BY after UNION names an alias of the first arm, then LIMIT (#160)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

// ✅ SUCCESS
const _result = await _db.query(
	`select name as n from users union all select title from posts order by n desc limit 3;`,
)

expectType<typeof _result>(toBe<{ n: string | null }[]>())
