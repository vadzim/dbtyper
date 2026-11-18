// PGT-2…PGT-11, PGT-3, PGT-4, PGT-35: the PostgreSQL type map follows what the `postgres` client returns by default.
import type postgres from "postgres"
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { postgresSqlDriver, type JsonValue } from "../../src/postgres/index.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

declare const client: ReturnType<typeof postgres>

const db = sqlMigrations({ driver: postgresSqlDriver({ sql: client }) })
	.apply(`create schema public;`)
	.apply(
		`create table t (
		a smallint not null, b int not null, c oid not null, d real not null, e float8 not null,
		f bigint not null, g numeric(10, 2) not null, h decimal not null,
		i boolean not null, j text not null, k varchar(5) not null, l char(2) not null, m uuid not null, n name not null,
		o date not null, p timestamp not null, q timestamptz not null, r timestamp(3) with time zone not null,
		s time not null, tz timetz not null, u interval not null,
		v bytea not null,
		w inet not null, x cidr not null, y macaddr not null, z money not null, aa xml not null, ab tsvector not null,
		ac bit(3) not null, ad varbit not null,
		ae json not null, af jsonb
	);`,
	)
	.database()

// PGT-2
const _p2 = await db.query(`select a, b, c, d, e from t`)
expectType<typeof _p2>(toBe<{ a: number; b: number; c: number; d: number; e: number }[]>())

// PGT-3: int8, numeric and decimal are strings, count(*) too
const _p3 = await db.query(`select f, g, h from t`)
expectType<typeof _p3>(toBe<{ f: string; g: string; h: string }[]>())
const _p3n = await db.query(`select count(*) as n from t`)
expectType<typeof _p3n>(toBe<{ n: string }[]>())

// PGT-5
const _p5 = await db.query(`select i, j, k, l, m, n from t`)
expectType<typeof _p5>(toBe<{ i: boolean; j: string; k: string; l: string; m: string; n: string }[]>())

// PGT-7, PGT-8
const _p7 = await db.query(`select o, p, q, r, s, tz, u from t`)
expectType<typeof _p7>(toBe<{ o: Date; p: Date; q: Date; r: Date; s: string; tz: string; u: string }[]>())

// PGT-9
const _p9 = await db.query(`select v from t`)
expectType<typeof _p9>(toBe<{ v: Uint8Array }[]>())

// PGT-10
const _p10 = await db.query(`select w, x, y, z, aa, ab, ac, ad from t`)
expectType<typeof _p10>(
	toBe<{ w: string; x: string; y: string; z: string; aa: string; ab: string; ac: string; ad: string }[]>(),
)

// PGT-11
const _p11 = await db.query(`select ae, af from t`)
// (a recursive type does not go through the invariant check: compare by assignability both ways)
type Row11 = (typeof _p11)[number]
const _jsonOut: JsonValue = {} as Row11["ae"]
const _jsonIn: Row11["ae"] = {} as JsonValue
const _jsonNullable: Row11["af"] = null
const _jsonNotNull: Row11["ae"] extends null ? never : true = true
void [_jsonOut, _jsonIn, _jsonNullable, _jsonNotNull]

// PGT-4: with `{ bigint: true }` int8 is bigint, numeric stays string
const big = sqlMigrations({ driver: postgresSqlDriver({ sql: client, bigint: true }) })
	.apply(`create schema public;`)
	.apply(`create table t (f bigint not null, g numeric not null);`)
	.database()
const _p4 = await big.query(`select f, g from t`)
expectType<typeof _p4>(toBe<{ f: bigint; g: string }[]>())
