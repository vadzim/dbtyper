// Error codes 1518 (GENERATED ALWAYS without AS), 1705 (DROP VIEW IF without EXISTS), 1706 (DROP VIEW without a name).
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteMockDriver })

const noAs = `create table t (a integer, b integer generated always);` as const
// @ts-expect-error
migrations.apply(noAs)
expectType<GetApplyError<typeof migrations, typeof noAs>>(
	toBe<DbtyperError<1518, "Expected AS after GENERATED ALWAYS in CREATE TABLE">>(),
)

const noExists = `drop view if v;` as const
// @ts-expect-error
migrations.apply(noExists)
expectType<GetApplyError<typeof migrations, typeof noExists>>(
	toBe<DbtyperError<1705, "Expected `exists` after `IF` in DROP VIEW">>(),
)

const noName = `drop view;` as const
// @ts-expect-error
migrations.apply(noName)
expectType<GetApplyError<typeof migrations, typeof noName>>(
	toBe<DbtyperError<1706, "Expected view name in DROP VIEW">>(),
)
