// Integration Test: INSERT … SELECT with a parameter and an unaliased column (#166)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, age integer not null); create table posts (id integer not null, user_id integer not null, body text not null);`,
	)
	.database()

// ✅ SUCCESS
const _result = await db.query(
	`insert into posts (id, user_id, body) select id, $1::integer, name from users where age > $2`,
	[1, 2],
)

expectType<typeof _result>(toBe<[]>())
