// Integration Test: a skipped statement with a closing parenthesis that was never opened
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer not null);`)

// ❌ ERROR: GRANT is skipped, but its brackets must still balance
const query = `grant select on users) to a;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1009, "Unmatched closing bracket: )">>())
