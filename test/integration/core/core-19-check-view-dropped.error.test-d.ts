// Integration Test: CORE-19 Check: select from a dropped view is 2200
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id integer not null, name text not null, email text); create view v as select id, name from users; drop view v;`,
	)
	.database()

// ❌ ERROR: CORE-19
const query = `select id from v` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2200, "Unknown table v in FROM">>())
