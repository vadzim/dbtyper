// Integration Test: CORE-14 - a SQL type with no TypeScript mapping in the driver's type map is a compile error
import { createDriver, sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import type { LexerFeatures } from "../../../src/lexer/sql-lexer.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

type SmallDriverConfig = {
	dialect: "postgres"
	scalarTypes: { integer: number; text: string }
	syntax: LexerFeatures
}
const smallDriver = createDriver<SmallDriverConfig>({ query: async () => [] })

const db = sqlMigrations({ driver: smallDriver })
	.apply(`create table t (id integer not null, flag boolean not null);`)
	.database()

// ❌ ERROR: boolean has no TypeScript type in this driver's type map
const query = `select id, flag from t;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		DbtyperError<
			3506,
			"No TypeScript type for SQL type boolean in the driver's type map; select it with a cast, e.g. `::text`"
		>
	>(),
)
