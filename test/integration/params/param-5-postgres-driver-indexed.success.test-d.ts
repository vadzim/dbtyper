// PARAM-5: with postgresSqlDriver, $n is accepted with an array of values.
import { sqlMigrations } from "../../../src/core/sql-database.ts"
import { postgresSqlDriver } from "../../../src/postgres/index.ts"
import { expectType, toBe } from "../../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: postgresSqlDriver({ sql: undefined as never }) })
	.apply(`create table users (id text not null, age integer);`)
	.database()

const _result = await db.query(`select * from users where id = $1;`, ["a"])

expectType<typeof _result>(toBe<Array<{ id: string; age: number | null }>>())
