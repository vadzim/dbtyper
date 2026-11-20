// Integration Test: INSERT … VALUES … ON CONFLICT followed by a SELECT (#149)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer primary key, name text not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(
	`insert into users (id, name) values (1, 'a') on conflict do nothing; select id from users`,
)

expectType<typeof _result>(toBe<Array<{ id: number }>>())
