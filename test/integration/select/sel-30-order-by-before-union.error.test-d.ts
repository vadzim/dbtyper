// Integration Test: SELECT - SEL-30 ORDER BY before UNION (#160)
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

const query = `select name from users order by name union select title from posts;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(
	toBe<
		DbtyperError<
			3416,
			"ORDER BY, LIMIT, OFFSET and FETCH go after the last SELECT of a UNION, INTERSECT or EXCEPT, not before it"
		>
	>(),
)
