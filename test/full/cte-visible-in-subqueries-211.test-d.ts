// #211: a CTE is visible in every subquery of its WITH … SELECT statement (WHERE, EXISTS, select list, HAVING), both dialects.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const tables = `create table t (id integer not null, x integer not null, y integer);`
const pg = sqlMigrations({ driver: mockDriver }).apply(tables).database()
const lite = sqlMigrations({ driver: sqliteDriver }).apply(tables).database()

const _p1 = await pg.query(`with c as (select id as y from t) select id from t where x in (select y from c);`)
expectType<typeof _p1>(toBe<Array<{ id: number }>>())
const _l1 = await lite.query(`with c as (select id as y from t) select id from t where x in (select y from c);`)
expectType<typeof _l1>(toBe<Array<{ id: number }>>())

const _p2 = await pg.query(
	`with c as (select id from t) select id from t where exists (select 1 from c where c.id = t.id);`,
)
expectType<typeof _p2>(toBe<Array<{ id: number }>>())
const _l2 = await lite.query(
	`with c as (select id from t) select id from t where exists (select 1 from c where c.id = t.id);`,
)
expectType<typeof _l2>(toBe<Array<{ id: number }>>())

const _p3 = await pg.query(`with c as (select id from t) select id, (select count(*) from c) as n from t;`)
expectType<typeof _p3>(toBe<Array<{ id: number; n: string | null }>>())
const _l3 = await lite.query(`with c as (select id from t) select id, (select count(*) from c) as n from t;`)
expectType<typeof _l3>(toBe<Array<{ id: number; n: number | null }>>())

const _p4 = await pg.query(
	`with c as (select id from t) select x, count(*) as n from t group by x having count(*) > (select count(*) from c);`,
)
expectType<typeof _p4>(toBe<Array<{ x: number; n: string }>>())
const _l4 = await lite.query(
	`with c as (select id from t) select x, count(*) as n from t group by x having count(*) > (select count(*) from c);`,
)
expectType<typeof _l4>(toBe<Array<{ x: number; n: number }>>())

// an unknown name is still an error inside the subquery
type PgQ<S extends string> = GetQueryError<typeof pg, S>
expectType<PgQ<"with c as (select id from t) select id from t where x in (select y from nope);">>(
	toBe<DbtyperError<2200, "Unknown table nope in FROM">>(),
)
