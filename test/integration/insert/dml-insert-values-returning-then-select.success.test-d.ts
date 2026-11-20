// Integration Test: INSERT … VALUES … RETURNING followed by a SELECT (#149)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS: the type is that of the last statement
const _result = await db.query(`insert into users (id, name) values (1, 'a') returning id; select name from users`)

expectType<typeof _result>(toBe<Array<{ name: string }>>())
