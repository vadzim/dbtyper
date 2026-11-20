// #210 (PostgreSQL): TYPE-18 / PGT-22 CASCADE reaches the views that read the dropped column anywhere (WHERE, JOIN ON,
// GROUP BY, HAVING, a second set-operation arm); SCHEMA-32 DROP TABLE of a referenced table needs CASCADE;
// PGT-40 default constraint names clash schema-wide.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E

// TYPE-18 / PGT-22 item 1
const base = sqlMigrations({ driver: mockDriver }).apply(
	`create domain email as text;
	 create table t (id integer not null, e email);
	 create table u (id integer not null, n integer);
	 create view v_where as select id from t where e is not null;
	 create view v_join as select t.id from t join u on u.n = t.id and t.e = 'a';
	 create view v_join2 as select t.id from u join t on t.id = u.id join u u2 on u2.id = t.id and t.e = 'a';
	 create view v_group as select count(*) as n from t group by e;
	 create view v_having as select count(*) as n from t group by id having max(e) > 'a';
	 create view v_arm2 as select id from u union select id from t where e = 'x';
	 create view v_arm2b as select id from u union select id from t group by id, e;
	 create view v_arm1 as select id from t where e = 'x' union select id from u;
	 create view v_plain as select t.id from t join u on u.n = t.id where u.n > 1;
	 create view v_sub as select id from u where n in (select id from t where e = 'a');`,
)
const noEmail = base.apply(`drop domain email cascade;`).database()
type Gone<V extends string> = Code<GetQueryError<typeof noEmail, `select count(*) as n from ${V}`>>
expectType<Gone<"v_where">>(toBe<2200>())
expectType<Gone<"v_join">>(toBe<2200>())
expectType<Gone<"v_join2">>(toBe<2200>())
expectType<Gone<"v_group">>(toBe<2200>())
expectType<Gone<"v_having">>(toBe<2200>())
expectType<Gone<"v_arm2">>(toBe<2200>())
expectType<Gone<"v_arm2b">>(toBe<2200>())
expectType<Gone<"v_arm1">>(toBe<2200>())
expectType<Gone<"v_sub">>(toBe<2200>())
const _plain = await noEmail.query(`select * from v_plain`)
expectType<typeof _plain>(toBe<Array<{ id: number }>>())

// SCHEMA-32 item 2
const fk = sqlMigrations({ driver: mockDriver }).apply(
	`create table p (id int primary key, x int unique);
	 create table c (pid int references p (id), q int);
	 create table self (id int primary key, parent int references self (id));
	 create table c2 (a int, constraint c2_fk foreign key (a) references p (x));`,
)
expectType<Code<GetApplyError<typeof fk, `drop table p;`>>>(toBe<3214>())
expectType<Code<GetApplyError<typeof fk, `drop table if exists p restrict;`>>>(toBe<3214>())
expectType<Code<GetApplyError<typeof fk, `alter table c drop constraint c_pid_fkey; drop table p;`>>>(toBe<3214>()) // c2 remains
fk.apply(`drop table p, c, c2;`)
fk.apply(`alter table c drop constraint c_pid_fkey; alter table c2 drop constraint c2_fk; drop table p;`)
fk.apply(`drop table self;`)
const afterCascade = fk.apply(`drop table p cascade;`).database()
const _c = await afterCascade.query(`select * from c`)
expectType<typeof _c>(toBe<Array<{ pid: number | null; q: number | null }>>())
// the foreign keys went with it: a new table named like one is fine, and dropping what it referenced is no error
fk.apply(
	`drop table p cascade; create table p (id int primary key); alter table c add constraint c_pid_fkey foreign key (pid) references p (id);`,
)

// PGT-40 item 3: the default name clashes with another table's constraint, in CREATE TABLE and ALTER TABLE
type Unknown<E> = Extract<E, DbtyperError<2220, string>>
type Known<E> = [Unknown<E>] extends [never] ? true : false
type OnConstraint<
	Tab extends string,
	Name extends string,
> = `insert into ${Tab} (a) values (1) on conflict on constraint ${Name} do nothing`
const _names = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table a (a integer, b_c integer unique);
		 create table a_b (a integer, c integer unique);
		 create table a_b_c (a integer);
		 alter table a_b_c add column x integer, add unique (a);
		 create table z (a integer, p integer unique);
		 create table z_p (a integer, key integer);
		 create table z_p_key (a integer unique);`,
	)
	.database()
// a(b_c) and a_b(c) both want a_b_c_key: the second is a_b_c_key1
expectType<Known<GetQueryError<typeof _names, OnConstraint<"a", "a_b_c_key">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof _names, OnConstraint<"a_b", "a_b_c_key1">>>>(toBe<true>())
expectType<Unknown<GetQueryError<typeof _names, OnConstraint<"a_b", "a_b_c_key">>>>(
	toBe<DbtyperError<2220, "Unknown constraint a_b_c_key on table a_b">>(),
)
// ALTER TABLE: a_b_c(a) is a_b_c_a_key, nobody has it
expectType<Known<GetQueryError<typeof _names, OnConstraint<"a_b_c", "a_b_c_a_key">>>>(toBe<true>())

// #212: ORDER BY and DISTINCT ON read the domain too
const base212 = sqlMigrations({ driver: mockDriver }).apply(
	`create domain email as text;
	 create table t (id integer not null, e email);
	 create view v_order as select id from t order by e;
	 create view v_order2 as select id from t order by id, lower(e) desc;
	 create view v_distinct as select distinct on (e) id from t;
	 create view v_distinct_order as select distinct on (id) id from t order by id, e;
	 create view v_arm_order as select id from t where id > 0 union select id from t order by id;
	 create view v_alias as select id as e from t order by e;
	 create view v_plain as select id from t order by id;`,
)
const noEmail212 = base212.apply(`drop domain email cascade;`).database()
type Gone212<V extends string> = Code<GetQueryError<typeof noEmail212, `select count(*) as n from ${V}`>>
expectType<Gone212<"v_order">>(toBe<2200>())
expectType<Gone212<"v_order2">>(toBe<2200>())
expectType<Gone212<"v_distinct">>(toBe<2200>())
expectType<Gone212<"v_distinct_order">>(toBe<2200>())
const _alias212 = await noEmail212.query(`select * from v_alias`)
expectType<typeof _alias212>(toBe<Array<{ e: number }>>())
const _plain212 = await noEmail212.query(`select * from v_plain`)
expectType<typeof _plain212>(toBe<Array<{ id: number }>>())

// #213: a window call reads the domain in its OVER (...) outside the select list (ORDER BY); named windows
// (WINDOW w AS ...) are not parsed at all yet (FN "Not yet"), so that position is not reachable.
const base213 = sqlMigrations({ driver: mockDriver }).apply(
	`create domain email as text;
	 create table t (id integer not null, e email, d integer);
	 create view v_over_part as select id from t order by row_number() over (partition by e order by d);
	 create view v_over_ord as select id from t order by row_number() over (order by e desc);
	 create view v_over_sel as select id, row_number() over (partition by e order by d) as rn from t;
	 create view v_over_plain as select id from t order by row_number() over (partition by d order by id);`,
)
const noEmail213 = base213.apply(`drop domain email cascade;`).database()
type Gone213<V extends string> = Code<GetQueryError<typeof noEmail213, `select count(*) as n from ${V}`>>
expectType<Gone213<"v_over_part">>(toBe<2200>())
expectType<Gone213<"v_over_ord">>(toBe<2200>())
expectType<Gone213<"v_over_sel">>(toBe<2200>())
const _plain213 = await noEmail213.query(`select * from v_over_plain`)
expectType<typeof _plain213>(toBe<Array<{ id: number }>>())
