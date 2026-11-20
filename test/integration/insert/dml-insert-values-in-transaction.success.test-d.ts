// Integration Test: INSERT … VALUES between BEGIN and COMMIT (#149)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`begin; insert into users (id, name) values (1, 'a'); commit;`)

expectType<typeof _result>(toBe<unknown>())
