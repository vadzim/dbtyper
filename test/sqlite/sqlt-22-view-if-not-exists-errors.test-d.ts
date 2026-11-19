// SQLT-22: the wrong spellings of CREATE VIEW IF NOT EXISTS name CREATE VIEW (3905, 3906)
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver }).apply(`create table t (id integer not null);`)

const noNot = `create view if exists v as select id from t;` as const
// @ts-expect-error
migrations.apply(noNot)
expectType<GetApplyError<typeof migrations, typeof noNot>>(
	toBe<DbtyperError<3905, "Expected `not` after `IF` in CREATE VIEW">>(),
)

const noExists = `create view if not v as select id from t;` as const
// @ts-expect-error
migrations.apply(noExists)
expectType<GetApplyError<typeof migrations, typeof noExists>>(
	toBe<DbtyperError<3906, "Expected `exists` after `IF NOT` in CREATE VIEW">>(),
)
