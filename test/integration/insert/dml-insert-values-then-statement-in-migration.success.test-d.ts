// Integration Test: INSERT … VALUES in the middle of a migration (#149)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table s (k text primary key); insert into s (k) values ('a'); create table s2 (a integer not null);`)
	.database()

// ✅ SUCCESS: the statement after the INSERT was applied
const _result = await db.query(`select a from s2;`)

expectType<typeof _result>(toBe<Array<{ a: number }>>())
