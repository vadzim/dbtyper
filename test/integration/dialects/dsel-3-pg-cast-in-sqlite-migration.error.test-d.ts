// Integration Test: DSEL-3, DSEL-5 - a migration of a SQLite chain is parsed as SQLite: :: in a DEFAULT is an error (1900)
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { sqliteMockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: sqliteMockDriver })

// ❌ ERROR: DSEL-3 the migration is SQLite too
const query = `create table users (id integer not null, name text not null default 'x'::text);` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<1900, "`::` cast is PostgreSQL-only; this database is SQLite. Use CAST(x AS TEXT)">>(),
)
