// Integration Test: SCHEMA-17 CREATE VIEW column list with a different count than the SELECT (3907)
import { sqlMigrations, type GetApplyError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const migrations = sqlMigrations({ driver: mockDriver }).apply(`create table t (id int not null, title text not null);`)

// ❌ ERROR: SCHEMA-17 count mismatch
const query = `create view bad (a) as select id, title from t;` as const

// @ts-expect-error
migrations.apply(query)

type ReturnedError = GetApplyError<typeof migrations, typeof query>

expectType<ReturnedError>(
	toBe<DbtyperError<3907, "CREATE VIEW bad: the column list has a different number of columns than the SELECT">>(),
)
