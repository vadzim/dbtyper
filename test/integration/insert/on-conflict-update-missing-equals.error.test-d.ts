// Integration Test: ON CONFLICT DO UPDATE SET
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text not null);`)
	.database()

// ❌ ERROR: an assignment without `=`
const query = `insert into users (id, name) values (1, 'a') on conflict (id) do update set name 'x';` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1219, "Expected `=` after column in ON CONFLICT UPDATE">>())
