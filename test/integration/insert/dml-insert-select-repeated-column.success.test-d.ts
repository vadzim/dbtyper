// Integration Test: INSERT … SELECT may repeat a source column (#166)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (a integer not null, b integer not null); create table posts (id integer not null);`)
	.database()

// ✅ SUCCESS
const _result = await db.query(`insert into t (a, b) select id, id from posts;`)

expectType<typeof _result>(toBe<[]>())
