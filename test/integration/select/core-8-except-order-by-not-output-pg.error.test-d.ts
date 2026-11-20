// Integration Test: CORE-8 ORDER BY after except on a non-output term gets its own code 3414 (pg)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table a (id integer not null, name text not null);`)
	.apply(`create table b (id integer not null, name text not null);`)
	.database()

const query = `select name from a except select name from b order by id` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		DbtyperError<
			3414,
			"ORDER BY after UNION, INTERSECT or EXCEPT can only use the output columns of the result: name one by its name or position"
		>
	>(),
)
