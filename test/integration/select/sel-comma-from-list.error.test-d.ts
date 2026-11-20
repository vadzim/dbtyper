// Integration Test: SELECT - SEL Not yet: a comma FROM list is 1115, not an unknown column
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { mockDriver } from "../../test-utils/test-databases.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id integer not null, name text);`)
	.apply(`create table posts (id integer not null, user_id integer not null, title text not null, score bigint);`)
	.database()

const query = `select u.id from users u, posts p where p.user_id = u.id;` as const

// @ts-expect-error
await db.query(query)

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1115, "Expected alias or join clause after table">>())
