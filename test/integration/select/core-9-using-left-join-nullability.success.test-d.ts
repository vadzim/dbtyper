// Integration Test: SELECT - CORE-9 USING with LEFT JOIN: the right side is nullable (SEL-18)
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table a (id integer not null, x text not null);`)
	.apply(`create table b (id integer not null, y text not null);`)
	.apply(`create table c (id integer, z text not null);`)
	.database()

// ✅ SUCCESS: CORE-9
const _result = await _db.query(`select id, z from a left join c using (id);`)

expectType<typeof _result>(toBe<{ id: number; z: string | null }[]>())
