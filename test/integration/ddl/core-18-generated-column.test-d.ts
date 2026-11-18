// Integration Test: CORE-18 a generated column is readable, writing it is an error; DML-4 it may be omitted in INSERT
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table t (id integer not null, a integer not null, g integer not null generated always as (a + 1) stored);`,
	)
	.database()

// ✅ SUCCESS: CORE-18 readable
const _rows = await db.query(`select g from t;`)
expectType<typeof _rows>(toBe<{ g: number }[]>())

// ✅ SUCCESS: DML-4 the generated NOT NULL column need not be in the INSERT list
await db.query(`insert into t (id, a) values (1, 2);`)

// ❌ ERROR: CORE-18 INSERT writes the generated column
const insertQuery = `insert into t (id, a, g) values (1, 2, 3);` as const

// @ts-expect-error
await db.query(insertQuery)

expectType<GetQueryError<typeof db, typeof insertQuery>>(
	toBe<DbtyperError<3512, "Cannot write generated column g in INSERT">>(),
)

// ❌ ERROR: CORE-18 UPDATE writes the generated column
const updateQuery = `update t set g = 5;` as const

// @ts-expect-error
await db.query(updateQuery)

expectType<GetQueryError<typeof db, typeof updateQuery>>(
	toBe<DbtyperError<3512, "Cannot write generated column g in UPDATE SET">>(),
)
