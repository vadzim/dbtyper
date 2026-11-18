// PGT-23 … PGT-34: PostgreSQL operators, DISTINCT ON, ON CONFLICT ON CONSTRAINT, data-modifying CTEs, function result types.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create schema public;`)
	.apply(
		`create table t (
			id integer primary key, name text not null, nick text, age integer, big bigint not null, n numeric,
			r real not null, d double precision, ok boolean not null, at timestamptz not null, ts timestamp,
			dt date not null, data jsonb, js json not null, tags text[] not null, nums integer[]
		);`,
	)
	.apply(`create table u (id integer primary key, code text not null, constraint u_code unique (code));`)
	.database()

// PGT-23
const _ops = await db.query(
	`select name similar to 'a%' as a, name ~ 'a' as b, nick ~* 'a' as c, name !~ 'a' as d, name !~* 'a' as e from t`,
)
expectType<typeof _ops>(toBe<{ a: boolean; b: boolean; c: boolean | null; d: boolean; e: boolean }[]>())
const _distinct = await db.query(`select distinct on (name) name, age from t order by name limit all`)
expectType<typeof _distinct>(toBe<{ name: string; age: number | null }[]>())

// PGT-24
const _json = await db.query(
	`select data->>'k' as k, data->'k' as j, js#>'{a,b}' as p, data#>>'{a}' as q, data @> '{}' as c, data <@ '{}' as d, data ? 'k' as e, data ?| array['a'] as f, data ?& array['a'] as g from t`,
)
expectType<typeof _json>(
	toBe<
		{
			k: string | null
			j: import("../../src/postgres/postgres-type-map.ts").JsonValue | null
			p: import("../../src/postgres/postgres-type-map.ts").JsonValue
			q: string | null
			c: boolean
			d: boolean
			e: boolean
			f: boolean
			g: boolean
		}[]
	>(),
)
