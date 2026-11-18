// Integration Test: CORE-14 - a SQL type with no TypeScript mapping in the driver's type map is a compile error (SQLite)
import { createDriver, sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

type SmallSqliteConfig = {
	dialect: "sqlite"
	scalarTypes: { integer: number; text: string; null: null }
	syntax: "question-params"
}

const db = sqlMigrations({ driver: createDriver<SmallSqliteConfig>({ query: async () => [] }) })
	.apply(`create table t (id integer not null, score real);`)
	.database()

// ❌ ERROR: REAL has no TypeScript type in this driver's type map
const query = `select id, score from t;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<3506, "No TypeScript type for SQL type real in the driver's type map">>())
