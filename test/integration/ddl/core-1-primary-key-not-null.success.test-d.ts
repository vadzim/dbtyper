// Integration Test: CORE-1 a PRIMARY KEY column (inline, named, or listed in a table-level key) is NOT NULL
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table k (code text primary key);`)
	.apply(`create table n (id integer constraint n_pk primary key, v text);`)
	.apply(`create table c (a integer, b integer, v text, constraint c_pk primary key (a, b));`)
	.database()

// ✅ SUCCESS: CORE-1 inline PRIMARY KEY
const _k = await _db.query(`select code from k;`)
expectType<typeof _k>(toBe<{ code: string }[]>())

// ✅ SUCCESS: CORE-1 named inline PRIMARY KEY, other columns stay nullable
const _n = await _db.query(`select id, v from n;`)
expectType<typeof _n>(toBe<{ id: number; v: string | null }[]>())

// ✅ SUCCESS: CORE-1 composite table-level PRIMARY KEY
const _c = await _db.query(`select a, b, v from c;`)
expectType<typeof _c>(toBe<{ a: number; b: number; v: string | null }[]>())
