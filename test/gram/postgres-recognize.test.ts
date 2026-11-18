import type { Recognize } from "../../src/gram/driver.ts"
import type { Tables } from "../../src/gram/postgres/tables.d.ts"
import type { PgTerminals } from "../../src/gram/postgres/tokens.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Pg<Query extends string> = Recognize<Tables, PgTerminals<Query>>

{
	type terminals =
		PgTerminals<`select a::int, 1.5, 'x', $1 from t where b <> 2 and c not in (1) order by d nulls first`>
	expectType<terminals>(
		toBe<
			[
				"select",
				"ident",
				"typecast",
				"int_p",
				",",
				"fconst",
				",",
				"sconst",
				",",
				"param",
				"from",
				"ident",
				"where",
				"ident",
				"not_equals",
				"iconst",
				"and",
				"ident",
				"not_la",
				"in_p",
				"(",
				"iconst",
				")",
				"order",
				"by",
				"ident",
				"nulls_la",
				"first_p",
			]
		>(),
	)
}

{
	type test = Pg<`select 1`>
	expectType<test>(toBe<{ ok: true }>())
}

{
	type test = Pg<`select a, b + 1 from t where a = 1 and b is not null`>
	expectType<test>(toBe<{ ok: true }>())
}

{
	type test = Pg<`insert into t (a, b) values (1, 'x') on conflict (a) do nothing returning a`>
	expectType<test>(toBe<{ ok: true }>())
}

{
	type test = Pg<`create table t (id int primary key, name text not null)`>
	expectType<test>(toBe<{ ok: true }>())
}

{
	type test = Pg<`select count(*) over (order by a) from t group by a having count(*) > 1 limit 2`>
	expectType<test>(toBe<{ ok: true }>())
}

{
	type test = Pg<`select , from t`>
	expectType<test>(toBe<{ ok: false; at: 1; token: "," }>())
}

{
	type test = Pg<`select from from t`>
	expectType<test>(toBe<{ ok: false; at: 2; token: "from" }>())
}

{
	// unexpected end
	type test = Pg<`select a from`>
	expectType<test>(toBe<{ ok: false; at: 3; token: "$end" }>())
}

{
	type test = Pg<`insert t values (1)`>
	expectType<test>(toBe<{ ok: false; at: 1; token: "ident" }>())
}

// long statements (#95, #22): one chunk of the driver is 100 steps, a run restarts chunks, so these cross many chunks
type Times10<T extends string[]> = [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]

{
	// 1 + 2000 + 3 terminals: select ident, ident, ... , ident from t
	type test = Recognize<Tables, ["select", ...Times10<Times10<Times10<["ident", ","]>>>, "ident", "from", "ident"]>
	expectType<test>(toBe<{ ok: true }>())
}
{
	type test = Recognize<Tables, ["select", ...Times10<Times10<Times10<["ident", ","]>>>, "ident", "from", "from"]>
	expectType<test>(toBe<{ ok: false; at: 2003; token: "from" }>())
}
