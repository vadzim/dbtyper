// SQLT-55: the action after ON CONFLICT of a column or table constraint is ROLLBACK, ABORT, FAIL, IGNORE or REPLACE.
// DLCT-3: DROP TYPE in a SQLite chain is the other-dialect error, like CREATE TYPE.
import { sqlMigrations, type GetApplyError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const migrations = sqlMigrations({ driver: sqliteDriver })

const columnBad = `create table c (a text unique on conflict foo);` as const
// @ts-expect-error
migrations.apply(columnBad)
expectType<GetApplyError<typeof migrations, typeof columnBad>>(
	toBe<DbtyperError<1920, "Expected ROLLBACK, ABORT, FAIL, IGNORE or REPLACE after ON CONFLICT">>(),
)

const tableBad = `create table c (a text, b int, unique (a, b) on conflict foo bar);` as const
// @ts-expect-error
migrations.apply(tableBad)
expectType<GetApplyError<typeof migrations, typeof tableBad>>(
	toBe<DbtyperError<1920, "Expected ROLLBACK, ABORT, FAIL, IGNORE or REPLACE after ON CONFLICT">>(),
)

const tableNoConflict = `create table c (a text, primary key (a) on foo bar);` as const
// @ts-expect-error
migrations.apply(tableNoConflict)

const dropType = `drop type t;` as const
// @ts-expect-error
migrations.apply(dropType)
