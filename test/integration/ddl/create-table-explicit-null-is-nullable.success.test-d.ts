// Integration Test: SCHEMA-11: no constraint and an explicit NULL both make the column nullable
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id int not null, a text, b text null);`)
	.database()

// ✅ SUCCESS: SCHEMA-11: no constraint and an explicit NULL both make the column nullable

const _result = await _db.query(`select * from t;`)

expectType<typeof _result>(toBe<{ id: number; a: string | null; b: string | null }[]>())
