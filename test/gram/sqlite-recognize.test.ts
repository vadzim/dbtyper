import type { Recognize } from "../../src/gram/driver.ts"
import type { Tables } from "../../src/gram/sqlite/tables.d.ts"
import type { SqliteTerminals } from "../../src/gram/sqlite/tokens.ts"
import type { PgTerminals } from "../../src/gram/postgres/tokens.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Sq<Query extends string> = Recognize<Tables, SqliteTerminals<Query>>
type Ok = { ok: true }

{
	type terminals =
		SqliteTerminals<"select a, `b`, [c d], \"e\", ?1, ?, :n, @m, $k from t where x == 1 and y != 2 || 'z'">
	expectType<terminals>(
		toBe<
			[
				"select",
				"id",
				"comma",
				"id",
				"comma",
				"id",
				"comma",
				"id",
				"comma",
				"variable",
				"comma",
				"variable",
				"comma",
				"variable",
				"comma",
				"variable",
				"comma",
				"variable",
				"from",
				"id",
				"where",
				"id",
				"eq",
				"integer",
				"and",
				"id",
				"ne",
				"integer",
				"concat",
				"string",
				"semi",
			]
		>(),
	)
}

// accepted
{
	type t1 = Sq<"select ?1">
	expectType<t1>(toBe<Ok>())
	type t2 = Sq<"insert or replace into t (id) values (1)">
	expectType<t2>(toBe<Ok>())
	type t3 = Sq<"select `a` from `t` where [b c] = 1">
	expectType<t3>(toBe<Ok>())
	type t4 = Sq<"create table t (id integer primary key autoincrement) strict">
	expectType<t4>(toBe<Ok>())
	type t5 = Sq<"select a -> 'x', b ->> 'y', c || d from t;">
	expectType<t5>(toBe<Ok>())
	type t6 = Sq<"select x between 1 and 2 and y from t order by 1 desc limit 3 offset 1">
	expectType<t6>(toBe<Ok>())
	type t7 = Sq<"with r as (select 1) select * from r join u on r.a = u.a">
	expectType<t7>(toBe<Ok>())
	type t8 = Sq<"insert into t (a) values (1) on conflict (a) do update set a = excluded.a returning a">
	expectType<t8>(toBe<Ok>())
	type t9 = Sq<"delete from t where a = 1 order by a limit 1">
	expectType<t9>(toBe<Ok>())
}

// %fallback: keywords as identifiers
{
	type t1 = Sq<"select abort, key, replace from rows where action = 1">
	expectType<t1>(toBe<Ok>())
	type t2 = Sq<'create table pragma (vacuum text, "abort" int)'>
	expectType<t2>(toBe<Ok>())
}

// WINDOW / OVER / FILTER are keywords only in their context
{
	type t1 = Sq<"select sum(x) over (order by y) from t">
	expectType<t1>(toBe<Ok>())
	type t2 = Sq<"select sum(x) filter (where x > 1) over w from t window w as (partition by y)">
	expectType<t2>(toBe<Ok>())
	type t3 = Sq<"select window, over, filter from t">
	expectType<t3>(toBe<Ok>())
	type t4 = Sq<"select window from over">
	expectType<t4>(toBe<Ok>())
}

// PostgreSQL-only syntax is rejected at the right token
{
	type t1 = Sq<"select id::text from users">
	expectType<t1>(toBe<{ ok: false; at: 2; token: "illegal" }>())
	type t2 = Sq<"select 1 from">
	expectType<t2>(toBe<{ ok: false; at: 3; token: "semi" }>())
	type t3 = Sq<"insert into t values (1) returning">
	expectType<t3>(toBe<{ ok: false; at: 8; token: "semi" }>())
	type t4 = Sq<"select * from t where a = $1">
	expectType<t4>(toBe<{ ok: false; at: 7; token: "$error" }>())
}

// the quoted identifier is never a keyword (#93 limit), in both dialects
{
	type pg = PgTerminals<`select "analyze", analyze from t`>
	expectType<pg>(toBe<["select", "ident", ",", "analyze", "from", "ident"]>())
	type sq = SqliteTerminals<`select "select", "from" from t`>
	expectType<sq>(toBe<["select", "id", "comma", "id", "from", "id", "semi"]>())
}
