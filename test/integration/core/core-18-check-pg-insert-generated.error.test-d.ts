// Integration Test: CORE-18 Check: insert into g is 3512
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t (id integer not null, a integer not null, g integer not null generated always as (a + 1) stored)`,
	)
	.database()

// ❌ ERROR: CORE-18
const query = `insert into t (id, a, g) values (1, 2, 3)` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3512, "Cannot write generated column g in INSERT">>())
