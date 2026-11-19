// #118 (PGT-3, PGT-33): an empty `OVER ()` and frame clauses are valid PostgreSQL, one shared rule with SQLite.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const pgDb = sqlMigrations({ driver: mockDriver })
	.apply(`create table users (id bigserial primary key, name text not null, balance numeric(12,2));`)
	.database()

const _empty = await pgDb.query(`select id, balance, count(*) over () as n from users`)
expectType<typeof _empty>(toBe<Array<{ id: string; balance: string | null; n: string }>>())

const _frame = await pgDb.query(
	`select id, count(*) over (order by id rows between unbounded preceding and current row) as n from users`,
)
expectType<typeof _frame>(toBe<Array<{ id: string; n: string }>>())

type Bad = GetQueryError<typeof pgDb, `select count(*) over (foo) as n from users`>
expectType<Bad extends never ? false : true>(toBe<true>())
