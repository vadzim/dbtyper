// PARAM-5: postgresSqlDriver does not accept ? at compile time
import { sqlMigrations, type GetQueryError } from "../../../src/core/sql-database.ts"
import type { DbtyperError } from "../../../src/dbtyper-error.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import { postgresSqlDriver } from "../../../src/postgres/index.ts"

const db = sqlMigrations({ driver: postgresSqlDriver({ sql: undefined as never }) })
	.apply(`create table users (id text not null, age integer);`)
	.database()

const query = `select * from users where id = ?;` as const

// @ts-expect-error
await db.query(query, ["a"])

type ReturnedError = GetQueryError<typeof db, typeof query>

expectType<ReturnedError>(toBe<DbtyperError<1007, "Unexpected token at: ?">>())
