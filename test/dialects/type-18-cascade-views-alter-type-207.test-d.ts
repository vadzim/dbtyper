// TYPE-18, #207 item 1: DROP DOMAIN | TYPE … CASCADE drops the views that read a column of the type (as PostgreSQL
// drops the views that depend on the dropped columns). Item 4b: ALTER COLUMN … TYPE keeps the column's user type.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E

const base = sqlMigrations({ driver: mockDriver }).apply(
	`create domain email as text;
	 create type point2 as (x integer, y integer);
	 create table t (id integer not null, e email, p point2);
	 create view v_col as select id, e from t;
	 create view v_expr as select id, lower(e) as l from t order by id;
	 create view v_star as select * from t;
	 create view v_alias as select x.* from t x;
	 create view v_sub as select s.e2 from (select e as e2 from t) s;
	 create view v_cte as with c as (select e from t) select * from c;
	 create view v_scalar as select (select max(e) from t) as m;
	 create view v_over as select id from v_col;
	 create view v_plain as select id from t;
	 create view v_point as select p from t;`,
)

const noEmail = base.apply(`drop domain email cascade;`).database()
type Gone<V extends string> = Code<GetQueryError<typeof noEmail, `select count(*) as n from ${V}`>>
expectType<Gone<"v_col">>(toBe<2200>())
expectType<Gone<"v_expr">>(toBe<2200>())
expectType<Gone<"v_star">>(toBe<2200>())
expectType<Gone<"v_alias">>(toBe<2200>())
expectType<Gone<"v_sub">>(toBe<2200>())
expectType<Gone<"v_cte">>(toBe<2200>())
expectType<Gone<"v_scalar">>(toBe<2200>())
expectType<Gone<"v_over">>(toBe<2200>())
// the views that read none of its columns stay
const _plain = await noEmail.query(`select * from v_plain`)
expectType<typeof _plain>(toBe<Array<{ id: number }>>())
const _point = await noEmail.query(`select count(*) as n from v_point`)
expectType<typeof _point>(toBe<Array<{ n: string }>>())

// DROP TYPE of the composite: only its views go
const noPoint = base.apply(`drop type point2 cascade;`).database()
expectType<Code<GetQueryError<typeof noPoint, `select count(*) as n from v_point`>>>(toBe<2200>())
expectType<Code<GetQueryError<typeof noPoint, `select count(*) as n from v_star`>>>(toBe<2200>())
const _col = await noPoint.query(`select * from v_col`)
expectType<typeof _col>(toBe<Array<{ id: number; e: string | null }>>())

// item 4b: ALTER COLUMN … TYPE to a domain makes the column a user of it, away from one frees the type
expectType<
	Code<
		GetApplyError<
			typeof base,
			`create domain d2 as integer; alter table t alter column id type d2; drop domain d2;`
		>
	>
>(toBe<3212>())
base.apply(`drop view v_col, v_expr, v_star, v_alias, v_sub, v_cte, v_scalar, v_over;
	 alter table t alter column e type text; drop domain email;`)
const _altered = base
	.apply(`create domain d2 as integer; alter table t alter column id type d2; drop domain d2 cascade;`)
	.database()
expectType<Code<GetQueryError<typeof _altered, `select id from t`>>>(toBe<2300>())
