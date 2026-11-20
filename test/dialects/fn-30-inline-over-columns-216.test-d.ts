// #216: the columns of an inline OVER (...) resolve against the FROM scope (FN-30), both dialects.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E

const ddl = `create table t (id integer not null, product text not null, amount integer not null);`
const _pg = sqlMigrations({ driver: mockDriver }).apply(ddl).database()
const _lite = sqlMigrations({ driver: sqliteMockDriver }).apply(ddl).database()
type Both<S extends string> = [GetQueryError<typeof _pg, S>, GetQueryError<typeof _lite, S>]
type BothCode<S extends string> = [Code<GetQueryError<typeof _pg, S>>, Code<GetQueryError<typeof _lite, S>>]

expectType<BothCode<`select row_number() over (partition by ghost) from t`>>(toBe<[2300, 2300]>())
expectType<BothCode<`select row_number() over (order by ghost) from t`>>(toBe<[2300, 2300]>())
expectType<BothCode<`select sum(amount) over (order by id rows between ghost preceding and current row) from t`>>(
	toBe<[2300, 2300]>(),
)
expectType<BothCode<`select id from t order by row_number() over (partition by ghost)`>>(toBe<[2300, 2300]>())
expectType<BothCode<`select row_number() over (w partition by ghost) from t window w as (order by id)`>>(
	toBe<[2300, 2300]>(),
)
expectType<Both<`select row_number() over (partition by product order by amount desc) from t`>>(toBe<[null, null]>())
expectType<Both<`select sum(amount) over (order by id rows between 1 preceding and current row) from t`>>(
	toBe<[null, null]>(),
)
expectType<Both<`select row_number() over (partition by x.product) from t as x`>>(toBe<[null, null]>())
