// Integration Test: CORE-20 Check: on conflict do nothing returning id, name
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create table posts (id integer not null, user_id integer not null, title text);`,
	)
	.database()

// ✅ SUCCESS: CORE-20
const _result = await _db.query(
	`insert into users (id, name) values (1, 'a') on conflict do nothing returning id, name`,
)

expectType<typeof _result>(toBe<{ id: number; name: string }[]>())
