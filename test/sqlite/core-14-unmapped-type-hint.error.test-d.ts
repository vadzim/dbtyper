// CORE-14: a SQL type without a TypeScript mapping is a compile error; the hint suggests a cast in the chain's own spelling
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteMockDriver })
	.apply(`create table t (id integer primary key, w blob);`)
	.database()

const query = `select w from t` as const
// @ts-expect-error
await db.query(query)

expectType<GetQueryError<typeof db, typeof query>>(
	toBe<
		DbtyperError<
			3506,
			"No TypeScript type for SQL type blob in the driver's type map; select it with a cast, e.g. `CAST(x AS TEXT)`"
		>
	>(),
)
