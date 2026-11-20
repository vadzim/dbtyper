// #207 item 2: a FOREIGN KEY of another table that references a dropped column. PostgreSQL refuses the drop without
// CASCADE (3213) and with CASCADE drops the constraint; renames of the column or its table keep the reference.
// SQLite has no such rule (and no CASCADE on DROP COLUMN).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E
type Unknown<E> = Extract<E, DbtyperError<2220, string>>
type Known<E> = [Unknown<E>] extends [never] ? true : false
type OnConstraint<
	Tab extends string,
	Name extends string,
> = `insert into ${Tab} (a) values (1) on conflict on constraint ${Name} do nothing`

const base = sqlMigrations({ driver: mockDriver }).apply(
	`create table p (id integer primary key, k integer not null unique);
	 create table q (a integer not null, pid integer references p, constraint q_k foreign key (a) references p (k));
	 create table r (a integer not null, pid integer, foreign key (pid) references p (id));
	 create table s (a integer not null, sid integer unique, parent integer references s (sid));`,
)

// without CASCADE: 3213, naming one constraint
expectType<GetApplyError<typeof base, `alter table p drop column k;`>>(
	toBe<
		DbtyperError<
			3213,
			"Column k is referenced by the foreign key q_k of table q; drop the constraint first or use CASCADE"
		>
	>(),
)
expectType<Code<GetApplyError<typeof base, `alter table p drop column id restrict;`>>>(toBe<3213>())
// a self-reference too, unless the dropped column is the constraint's own
expectType<Code<GetApplyError<typeof base, `alter table s drop column sid;`>>>(toBe<3213>())
base.apply(`alter table s drop column parent;`)
// @ts-expect-error 3213
base.apply(`alter table p drop column k;`)

// CASCADE drops the referencing constraints, the others stay
const dropped = base.apply(`alter table p drop column id cascade;`).database()
expectType<Unknown<GetQueryError<typeof dropped, OnConstraint<"q", "q_pid_fkey">>>>(
	toBe<DbtyperError<2220, "Unknown constraint q_pid_fkey on table q">>(),
)
expectType<Unknown<GetQueryError<typeof dropped, OnConstraint<"r", "r_pid_fkey">>>>(
	toBe<DbtyperError<2220, "Unknown constraint r_pid_fkey on table r">>(),
)
expectType<Known<GetQueryError<typeof dropped, OnConstraint<"q", "q_k">>>>(toBe<true>())
// … and with the constraints gone the other column drops without CASCADE
base.apply(`alter table p drop column id cascade; alter table q drop constraint q_k; alter table p drop column k;`)
// dropping the referencing constraint or table first works too
base.apply(`alter table q drop constraint q_k; alter table p drop column k;`)
base.apply(`drop table q; drop table r; alter table p drop column id;`)

// a renamed column or table is still referenced
expectType<Code<GetApplyError<typeof base, `alter table p rename column k to k2; alter table p drop column k2;`>>>(
	toBe<3213>(),
)
expectType<Code<GetApplyError<typeof base, `alter table p rename to p2; alter table p2 drop column k;`>>>(toBe<3213>())

// ALTER TABLE … ADD FOREIGN KEY references too
expectType<
	GetApplyError<
		typeof base,
		`create table u (a integer); alter table u add foreign key (a) references p (k);
		 alter table q drop constraint q_k; alter table p drop column k;`
	>
>(
	toBe<
		DbtyperError<
			3213,
			"Column k is referenced by the foreign key u_a_fkey of table u; drop the constraint first or use CASCADE"
		>
	>(),
)

// TYPE-18: DROP DOMAIN … CASCADE drops the columns of the domain and the foreign keys to them
const dom = sqlMigrations({ driver: mockDriver })
	.apply(
		`create domain code as integer;
		 create table c (a integer not null, k code unique);
		 create table d (a integer not null, ck integer references c (k));
		 drop domain code cascade;`,
	)
	.database()
expectType<Unknown<GetQueryError<typeof dom, OnConstraint<"d", "d_ck_fkey">>>>(
	toBe<DbtyperError<2220, "Unknown constraint d_ck_fkey on table d">>(),
)

// SQLite: no such rule
sqlMigrations({ driver: sqliteDriver }).apply(
	`create table p (id integer primary key, k integer); create table q (a integer references p (k));
	 alter table p drop column k;`,
)
