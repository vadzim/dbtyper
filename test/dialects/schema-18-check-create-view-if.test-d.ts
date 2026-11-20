// Integration Test: SCHEMA-18 Check: `create view if v as select 1;` is 3908 and `create view if not v as select 1;` 3909 (PostgreSQL mock driver)
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const base = sqlMigrations({ driver: mockDriver })
const v8 = `create view if v as select 1;` as const
const v9 = `create view if not v as select 1;` as const
// @ts-expect-error
base.apply(v8)
// @ts-expect-error
base.apply(v9)
// SCHEMA-18
expectType<GetApplyError<typeof base, typeof v8>>(
	toBe<DbtyperError<3908, "Expected `not` after `IF` in CREATE VIEW">>(),
)
expectType<GetApplyError<typeof base, typeof v9>>(
	toBe<DbtyperError<3909, "Expected `exists` after `IF NOT` in CREATE VIEW">>(),
)
