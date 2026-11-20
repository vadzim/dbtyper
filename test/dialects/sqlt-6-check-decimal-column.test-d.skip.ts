// SKIPPED (excluded in tsconfig.test.json): SQLT-6 Check, column `d` (decimal(10,2) not null) must be `number`.
// The code types NUMERIC affinity as `number | string` (src/sqlite/sqlite-type-map.ts, #169 NUMERIC in bigint mode / SQLite numerics).
// Open bug #169; SPEC-Q SQLT-6 d: the Check says `number`, the code (deliberately) `number | string`. Options: A) fix the Check B) fix the code.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table t (a bigint not null, b varchar(10) not null, c double precision not null, d decimal(10,2) not null, e blob not null, f not null)`,
	)
	.database()
const _t = await db.query(`select a, b, c, d, e, f from t`)
expectType<typeof _t>(
	toBe<Array<{ a: number; b: string; c: number; d: number; e: Uint8Array; f: number | string | Uint8Array }>>(),
)
