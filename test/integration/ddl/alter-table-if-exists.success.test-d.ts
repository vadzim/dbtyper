// Integration Test: SCHEMA-24 ALTER TABLE IF EXISTS is applied or a no-op, never corrupts the schema
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null); alter table if exists t add column q int;`)
	.apply(`alter table if exists missing add column q int;`)
	.database()

const result = await db.query(`select * from t;`)
expectType<typeof result>(toBe<{ id: number; q: number | null }[]>())
