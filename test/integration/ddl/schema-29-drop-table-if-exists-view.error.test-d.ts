// Integration Test: SCHEMA-29 DROP TABLE IF EXISTS does not hide that the name is a view
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id int not null);`)
	.apply(`create view v as select id from t;`)

// ❌ ERROR: DROP TABLE IF EXISTS names a view
const query = `drop table if exists v;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3502, "DROP TABLE targets a view; use DROP VIEW">>())
