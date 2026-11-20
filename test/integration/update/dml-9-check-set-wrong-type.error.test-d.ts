// Integration Test: DML-9 Check: update with a wrong-typed SET is 2507
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table users (id text not null, name text not null, email text); create table users_backup (id text not null, name text not null);`,
	)
	.database()

// ❌ ERROR: DML-9
const query = `update users set name = 'x', id = 1 where users.id = 'u';` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<2507, "Incompatible value type for column id">>())
