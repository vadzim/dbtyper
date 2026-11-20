// #214: named windows, FN-30…FN-35 Check lines, in both dialects (FN-35 CASCADE in PostgreSQL, where DROP TYPE exists).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteMockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E

const ddl = `create table sales (id integer not null, product text not null, amount integer not null);`
const pg = sqlMigrations({ driver: mockDriver }).apply(ddl).database()
const lite = sqlMigrations({ driver: sqliteMockDriver }).apply(ddl).database()
type Pg<S extends string> = GetQueryError<typeof pg, S>
type Lite<S extends string> = GetQueryError<typeof lite, S>
type Both<S extends string> = [Pg<S>, Lite<S>]
type BothCode<S extends string> = [Code<Pg<S>>, Code<Lite<S>>]

// Check FN-30
const _pgRn = await pg.query(
	`select row_number() over w as rn from sales window w as (partition by product order by amount desc)`,
)
expectType<typeof _pgRn>(toBe<Array<{ rn: string }>>())
const _liteRn = await lite.query(
	`select row_number() over w as rn from sales window w as (partition by product order by amount desc)`,
)
expectType<typeof _liteRn>(toBe<Array<{ rn: number }>>())
expectType<
	Both<`select id, sum(amount) over w as s from sales group by id, amount having count(*) > 0 window w as (order by id) order by id`>
>(toBe<[null, null]>())
expectType<Pg<`select row_number() over w from sales window w as (partition by ghost)`>>(
	toBe<DbtyperError<2300, "Unknown column ghost in WINDOW clause">>(),
)
expectType<BothCode<`select row_number() over w from sales window w as (partition by ghost)`>>(toBe<[2300, 2300]>())
expectType<
	Both<`select sum(amount) over w as s from sales window w as (order by id rows between unbounded preceding and current row)`>
>(toBe<[null, null]>())
expectType<
	Both<`select sum(amount) over w as s from sales window w as (order by id range between 1 preceding and 2 following)`>
>(toBe<[null, null]>())
expectType<Both<`select sum(amount) over w as s from sales window w as (order by id groups 2 preceding)`>>(
	toBe<[null, null]>(),
)
expectType<Both<`select id from sales window w as (order by id)`>>(toBe<[null, null]>())
expectType<BothCode<`select (select row_number() over w from sales) from sales window w as (order by id)`>>(
	toBe<[4604, 4604]>(),
)
// a subquery's own WINDOW clause is its own; another set-operation arm does not see it
expectType<Both<`select (select row_number() over w from sales window w as (order by id) limit 1) as x from sales`>>(
	toBe<[null, null]>(),
)
expectType<
	BothCode<`select row_number() over w as rn from sales window w as (order by id) union select row_number() over w as rn from sales`>
>(toBe<[4604, 4604]>())
// a window named with another case is the same window; WINDOW is a reserved word, not a table alias
expectType<Both<`select row_number() over W as rn from sales window w as (order by id)`>>(toBe<[null, null]>())
expectType<Both<`select 1 as one window w as (order by 1)`>>(toBe<[null, null]>())

// Check FN-31
const _pgExt = await pg.query(
	`select row_number() over (w order by amount) as rn from sales window w as (partition by product)`,
)
expectType<typeof _pgExt>(toBe<Array<{ rn: string }>>())
const _pgW2 = await pg.query(
	`select rank() over w2 as r from sales window w as (partition by product), w2 as (w order by amount)`,
)
expectType<typeof _pgW2>(toBe<Array<{ r: string }>>())
const _liteW2 = await lite.query(
	`select rank() over w2 as r from sales window w as (partition by product), w2 as (w order by amount)`,
)
expectType<typeof _liteW2>(toBe<Array<{ r: number }>>())
const _pgSum = await pg.query(`select sum(amount) over w as s from sales window w as (order by id)`)
const _pgSumInline = await pg.query(`select sum(amount) over (order by id) as s from sales`)
expectType<typeof _pgSum>(toBe<typeof _pgSumInline>())
expectType<typeof _pgSum>(toBe<Array<{ s: string | null }>>())
const _liteSum = await lite.query(`select sum(amount) over w as s from sales window w as (order by id)`)
const _liteSumInline = await lite.query(`select sum(amount) over (order by id) as s from sales`)
expectType<typeof _liteSum>(toBe<typeof _liteSumInline>())
expectType<BothCode<`select rank() over w2 from sales window w2 as (w1 order by id), w1 as (partition by product)`>>(
	toBe<[4604, 4604]>(),
)
expectType<BothCode<`select 1 from sales window w as (w order by id)`>>(toBe<[4604, 4604]>())
// OVER w in ORDER BY
expectType<Both<`select id from sales window w as (order by id) order by rank() over w`>>(toBe<[null, null]>())
expectType<BothCode<`select id from sales window w as (order by id) order by rank() over v`>>(toBe<[4604, 4604]>())

// Check FN-32
expectType<Pg<`select row_number() over w from sales`>>(toBe<DbtyperError<4604, "Unknown window: w">>())
expectType<BothCode<`select row_number() over w from sales`>>(toBe<[4604, 4604]>())
expectType<BothCode<`select row_number() over (w order by id) from sales window v as (order by id)`>>(
	toBe<[4604, 4604]>(),
)
expectType<Pg<`select 1 from sales window w as (order by id), w as (order by amount)`>>(
	toBe<DbtyperError<4605, "Duplicate window name: w">>(),
)
expectType<BothCode<`select 1 from sales window w as (order by id), w as (order by amount)`>>(toBe<[4605, 4605]>())
expectType<BothCode<`select 1 from sales window w as (order by id), W as (order by amount)`>>(toBe<[4605, 4605]>())

// Check FN-33
expectType<Pg<`select row_number() over (w partition by id) from sales window w as (order by id)`>>(
	toBe<DbtyperError<4606, "Window w already has PARTITION BY; OVER cannot add one">>(),
)
expectType<BothCode<`select row_number() over (w partition by id) from sales window w as (order by id)`>>(
	toBe<[4606, 4606]>(),
)
expectType<Both<`select row_number() over (w order by id) from sales window w as (partition by product)`>>(
	toBe<[null, null]>(),
)
expectType<Pg<`select row_number() over (w order by id) from sales window w as (order by amount)`>>(
	toBe<DbtyperError<4607, "Window w already has ORDER BY; OVER cannot add one">>(),
)
expectType<BothCode<`select row_number() over (w order by id) from sales window w as (order by amount)`>>(
	toBe<[4607, 4607]>(),
)
expectType<Both<`select sum(amount) over (w rows unbounded preceding) from sales window w as (order by id)`>>(
	toBe<[null, null]>(),
)
expectType<
	Pg<`select sum(amount) over (w rows unbounded preceding) from sales window w as (order by id rows current row)`>
>(toBe<DbtyperError<4608, "Window w has a frame clause; OVER cannot add or copy one">>())
expectType<
	BothCode<`select sum(amount) over (w rows unbounded preceding) from sales window w as (order by id rows current row)`>
>(toBe<[4608, 4608]>())
expectType<BothCode<`select 1 from sales window w as (order by id), w2 as (w partition by id)`>>(toBe<[4606, 4606]>())
expectType<BothCode<`select 1 from sales window w as (order by id), w2 as (w order by amount)`>>(toBe<[4607, 4607]>())
expectType<BothCode<`select sum(amount) over (w) from sales window w as (order by id rows current row)`>>(
	toBe<[4608, null]>(),
)
expectType<Both<`select sum(amount) over w from sales window w as (order by id rows current row)`>>(
	toBe<[null, null]>(),
)

// Check FN-34
expectType<Pg<`select id from sales order by id window w as (order by id)`>>(
	toBe<DbtyperError<4609, "WINDOW clause must come after HAVING and before ORDER BY">>(),
)
expectType<BothCode<`select id from sales order by id window w as (order by id)`>>(toBe<[4609, 4609]>())
expectType<BothCode<`select id from sales window w as (order by id) having count(*) > 0`>>(toBe<[4609, 4609]>())
expectType<BothCode<`select id from sales window w as (order by id) where id > 1`>>(toBe<[4609, 4609]>())
expectType<BothCode<`select id from sales window w as (order by id) group by id`>>(toBe<[4609, 4609]>())
expectType<Both<`select id from sales window w as (order by id) limit 1`>>(toBe<[null, null]>())
expectType<BothCode<`select id from sales limit 1 window w as (order by id)`>>(toBe<[4609, 4609]>())
expectType<BothCode<`select id from sales offset 1 window w as (order by id)`>>(toBe<[4609, 4609]>())
expectType<BothCode<`select 1 from sales window w (order by id)`>>(toBe<[4600, 4600]>())
expectType<BothCode<`select 1 from sales window w as order by id`>>(toBe<[4600, 4600]>())
expectType<BothCode<`select 1 from sales window w as (order by id`>>(toBe<[4601, 4601]>())
expectType<BothCode<`select 1 from sales window w as (limit 1)`>>(toBe<[4602, 4602]>())

// Check FN-35
const withEnum = sqlMigrations({ driver: mockDriver }).apply(
	`create type e as enum ('a', 'b');
	 create table t (id integer not null, c e not null);
	 create view v as select id, row_number() over w as rn from t window w as (order by c);
	 create view v2 as select row_number() over (partition by c) as rn from t;
	 create view v_unused as select id from t window w as (partition by c);
	 create view v_where as select id from t where c = 'a';
	 create view v_plain as select id, row_number() over w as rn from t window w as (order by id);`,
)
const noEnum = withEnum.apply(`drop type e cascade;`).database()
type Gone<V extends string> = GetQueryError<typeof noEnum, `select * from ${V}`>
expectType<Gone<"v">>(toBe<DbtyperError<2200, "Unknown table v in FROM">>())
expectType<Code<Gone<"v2">>>(toBe<2200>())
expectType<Code<Gone<"v_unused">>>(toBe<2200>())
expectType<Code<Gone<"v_where">>>(toBe<2200>()) // TYPE-18: an enum read outside the select list counts too
const _plain = await noEnum.query(`select * from v_plain`)
expectType<typeof _plain>(toBe<Array<{ id: number; rn: string }>>())
expectType<Code<GetApplyError<typeof withEnum, `drop type e;`>>>(toBe<3212>())
// a frame offset is a read too (FN-35)
const withDomain = sqlMigrations({ driver: mockDriver }).apply(
	`create domain n as integer;
	 create table t (id integer not null, k n);
	 create view v_frame as select sum(id) over w as s from t window w as (order by id rows between k preceding and current row);
	 create view v_inline as select sum(id) over (order by id rows k preceding) as s from t;`,
)
const _noDomain = withDomain.apply(`drop domain n cascade;`).database()
expectType<Code<GetQueryError<typeof _noDomain, `select * from v_frame`>>>(toBe<2200>())
expectType<Code<GetQueryError<typeof _noDomain, `select * from v_inline`>>>(toBe<2200>())
