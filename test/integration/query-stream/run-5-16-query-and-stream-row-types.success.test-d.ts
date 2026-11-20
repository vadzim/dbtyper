// Integration Test: RUN-5 and RUN-16 Checks (verification/runtime.md @ 2a941c8): exact row types of query and stream.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id text not null, name text not null);`)
	.apply(`create schema auth;`)
	.apply(`create table auth.users (email text not null, display_name text);`)
	.database()

// RUN-5: select and delete ... returning have the same type
const _select = await db.query(`select id, name from users;`)
expectType<typeof _select>(toBe<Array<{ id: string; name: string }>>())
const _delete = await db.query(`delete from users where id = '1' returning id, name;`)
expectType<typeof _delete>(toBe<Array<{ id: string; name: string }>>())
expectType<typeof _delete>(toBe<typeof _select>())

// RUN-16: rows of the stream are { email: string } (the row count, at most 5, is the SQL's: see the runtime test)
for await (const row of await db.stream(`select email from auth.users limit 5;`)) {
	expectType<typeof row>(toBe<{ email: string }>())
}
