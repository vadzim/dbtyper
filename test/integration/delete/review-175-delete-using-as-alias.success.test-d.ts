// Integration Test: DELETE … USING t AS alias (#175 "one alias parser": the USING copy took `as` for the alias)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null);`)
	.apply(`create table banned (user_id integer not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`delete from users using banned as b where b.user_id = users.id returning id;`)

expectType<typeof _result>(toBe<Array<{ id: number }>>())
