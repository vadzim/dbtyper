// Integration Test: CORE-4: a scalar subquery is nullable
import { createDriver, sqlMigrations } from "../../../src/core/sql-database.ts"
import type { SqliteDriverConfig } from "../../../src/sqlite/sqlite-type-map.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: createDriver<SqliteDriverConfig>({ query: async () => [] }) })
	.apply(
		`create table users (id integer primary key, name text not null, email text); create table posts (id integer primary key, user_id integer not null, title text, score real);`,
	)
	.database()

// ✅ SUCCESS: CORE-4: a scalar subquery is nullable
const _result = await _db.query(
	`select (select title from posts p where p.user_id = u.id) as t, (select count(*) from posts) as n from users u;`,
)

expectType<typeof _result>(toBe<{ t: string | null; n: number | null }[]>())
