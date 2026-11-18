// #116 batch H: the GROUP BY aggregate check reads the catalog of the chain's own dialect.
// SQLite overloads `max`/`min` by argument count (`max(a, b)` is the scalar); the PostgreSQL row takes any count and is
// an aggregate.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const sqliteDb = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (id integer primary key, name text not null, age integer not null);`)
	.database()
const pgDb = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(`create table t (id integer primary key, name text not null, age integer not null);`)
	.database()

// SQLite: one-argument `max` is an aggregate, so `age` needs no grouping inside it; SQLite has no GROUP BY rule.
const _sqliteAgg = await sqliteDb.query(`select name, max(age) as m from t group by name`)
expectType<typeof _sqliteAgg>(toBe<Array<{ name: string; m: number | null }>>())

// PostgreSQL: `max(age)` is the aggregate; a bare `age` next to it is the GROUP BY error (the rule is PostgreSQL's)
const _pgAgg = await pgDb.query(`select name, max(age) as m from t group by name`)
expectType<typeof _pgAgg>(toBe<Array<{ name: string; m: number | null }>>())
type PgBare = GetQueryError<typeof pgDb, `select age, max(age) as m from t`>
expectType<PgBare extends DbtyperError<3403, string> ? true : false>(toBe<true>())
// PostgreSQL: `max(age, 1)` is decided by the PostgreSQL row (an aggregate), not by SQLite's scalar `max/2`, so `age`
// inside it needs no GROUP BY (before, SQLite's row decided in every chain and this was the GROUP BY error 3403)
const _pgTwo = await pgDb.query(`select name, max(age, 1) as m from t group by name`)
expectType<typeof _pgTwo>(toBe<Array<{ name: string; m: number | null }>>())
