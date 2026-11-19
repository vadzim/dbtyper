// Integration Test: STMT-6 a function with a $$ body containing `;` is skipped and the next statement applies
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../../src/postgres/index.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"
import type postgres from "postgres"

declare const client: ReturnType<typeof postgres>

const db = sqlMigrations({ driver: postgresSqlDriver({ sql: client }) })
	.apply(`create function f() returns int as $$ select 1; $$ language sql; create table t2 (x int);`)
	.database()

const _result = await db.query(`select x from t2`)

expectType<typeof _result>(toBe<{ x: number | null }[]>())
