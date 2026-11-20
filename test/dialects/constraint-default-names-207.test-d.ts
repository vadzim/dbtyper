// #207 item 4: every constraint is tracked by name, the unnamed ones under the name PostgreSQL gives them
// (`<table>_<columns>_key | _fkey | _check`, `<table>_pkey`, numbered when taken, cut to 63 characters); an inline
// `CONSTRAINT n PRIMARY KEY` keeps its name.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

/** The unknown-constraint error of an INSERT, or `never` when the constraint is known. */
type Unknown<E> = Extract<E, DbtyperError<2220, string>>
/** The constraint is known: no 2220. */
type Known<E> = [Unknown<E>] extends [never] ? true : false
type OnConstraint<
	Tab extends string,
	Name extends string,
> = `insert into ${Tab} (a) values (1) on conflict on constraint ${Name} do nothing`

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t (a integer not null unique, b integer check (b > 0), c integer check (b > c),
			 d integer references t (a), unique (a, b), unique (a, b), check (a > 0));
		 create table p (a integer constraint p_named primary key);
		 create table q (a integer not null, b integer);
		 alter table q add unique (a), add check (b > 0), add column c integer unique, add constraint q_c primary key (a);
		 create table a_very_long_table_name_for_constraint_names_xxxxxxxxxx (a integer not null, a_long_column_name_here integer unique);`,
	)
	.database()

// CREATE TABLE: column and table constraints
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_a_key">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_b_check">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_check">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_d_fkey">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_a_b_key">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_a_b_key1">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"t", "t_a_check">>>>(toBe<true>())
// a name nobody has is 2220 now (it used to pass by its pattern)
expectType<Unknown<GetQueryError<typeof db, OnConstraint<"t", "t_x_key">>>>(
	toBe<DbtyperError<2220, "Unknown constraint t_x_key on table t">>(),
)
expectType<Unknown<GetQueryError<typeof db, OnConstraint<"t", "t_pkey">>>>(
	toBe<DbtyperError<2220, "Unknown constraint t_pkey on table t">>(),
)

// item 4a: an inline named PRIMARY KEY keeps its name
expectType<Known<GetQueryError<typeof db, OnConstraint<"p", "p_named">>>>(toBe<true>())
expectType<Unknown<GetQueryError<typeof db, OnConstraint<"p", "p_pkey">>>>(
	toBe<DbtyperError<2220, "Unknown constraint p_pkey on table p">>(),
)
const _dropped = sqlMigrations({ driver: mockDriver })
	.apply(`create table p (a integer constraint p_named primary key); alter table p drop constraint p_named;`)
	.apply(`alter table p add primary key (a);`) // the key is gone: a new one is no 1519
	.database()
expectType<Known<GetQueryError<typeof _dropped, OnConstraint<"p", "p_pkey">>>>(toBe<true>())

// ALTER TABLE: ADD UNIQUE / CHECK, ADD COLUMN … UNIQUE, a named PRIMARY KEY
expectType<Known<GetQueryError<typeof db, OnConstraint<"q", "q_a_key">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"q", "q_b_check">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"q", "q_c_key">>>>(toBe<true>())
expectType<Known<GetQueryError<typeof db, OnConstraint<"q", "q_c">>>>(toBe<true>())

// over 63 characters the longer part is cut (PostgreSQL's makeObjectName)
expectType<
	Known<
		GetQueryError<
			typeof db,
			OnConstraint<
				"a_very_long_table_name_for_constraint_names_xxxxxxxxxx",
				"a_very_long_table_name_for_constrai_a_long_column_name_here_key"
			>
		>
	>
>(toBe<true>())

// DROP COLUMN and DROP CONSTRAINT remove default-named constraints too
const after = sqlMigrations({ driver: mockDriver })
	.apply(
		`create table t (a integer not null unique, b integer unique);
		 alter table t drop column b, drop constraint t_a_key;`,
	)
	.database()
expectType<Unknown<GetQueryError<typeof after, OnConstraint<"t", "t_a_key">>>>(
	toBe<DbtyperError<2220, "Unknown constraint t_a_key on table t">>(),
)
expectType<Unknown<GetQueryError<typeof after, OnConstraint<"t", "t_b_key">>>>(
	toBe<DbtyperError<2220, "Unknown constraint t_b_key on table t">>(),
)
