// Integration Test: CORE-8 ORDER BY after intersect on a non-output term gets its own code 3414 (pg)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table a (id integer not null, name text not null);`)
	.apply(`create table b (id integer not null, name text not null);`)
	.database()

const expr = `select name from a intersect select name from b order by upper(name)` as const
const col = `select name from a intersect select name from b order by id` as const

// @ts-expect-error
await db.query(expr)
// @ts-expect-error
await db.query(col)

expectType<GetQueryError<typeof db, typeof expr>>(
	toBe<
		DbtyperError<
			3414,
			"ORDER BY after UNION, INTERSECT or EXCEPT can only use the output columns of the result: name one by its name or position"
		>
	>(),
)
expectType<GetQueryError<typeof db, typeof col>>(
	toBe<
		DbtyperError<
			3414,
			"ORDER BY after UNION, INTERSECT or EXCEPT can only use the output columns of the result: name one by its name or position"
		>
	>(),
)
