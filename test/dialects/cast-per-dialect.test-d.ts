// #116 item 27: CAST rules per dialect. PostgreSQL names the type, SQLite names an affinity (SQLT-6, SQLT-12);
// the PostgreSQL-only boolean/integer cast errors 4503/4504 are tested in test/integration/select.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const sqliteDb = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (id integer primary key, name text not null, age integer not null, ok boolean not null);`)
	.database()
const pgDb = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer primary key, name text not null, age integer not null, ok boolean not null);`)
	.database()

// SQLite: the written type name only decides an affinity (INT -> integer, VARCHAR(10) -> text, DOUBLE -> real)
const _sq = await sqliteDb.query(
	`select cast(name as int) as a, cast(age as varchar(10)) as b, cast(age as double) as c, cast(name as bigint) as d from t`,
)
expectType<typeof _sq>(toBe<Array<{ a: number; b: string; c: number; d: number }>>())

// PostgreSQL: the written type is the type
const _pg = await pgDb.query(
	`select cast(age as text) as a, cast(name as int4) as b, cast(age as bigint) as c, cast(ok as bool) as d from t`,
)
expectType<typeof _pg>(toBe<Array<{ a: string; b: number; c: string; d: boolean }>>())

// #119 (EXPR-22, PGT-2): casts to the floating-point names are number in PostgreSQL; numeric stays string
const _pgf = await pgDb.query(
	`select cast(age as real) as a, age::float4 as b, cast(age as float8) as c, age::double precision as d, cast(age as numeric) as e from t`,
)
expectType<typeof _pgf>(toBe<Array<{ a: number; b: number; c: number; d: number; e: string }>>())
const _sqf = await sqliteDb.query(
	`select cast(age as real) as a, cast(age as float4) as b, cast(age as float8) as c, cast(age as double precision) as d from t`,
)
expectType<typeof _sqf>(toBe<Array<{ a: number; b: number; c: number; d: number }>>())

// SQLT-12: a schema-qualified cast type is classified by its last part (main.int -> integer affinity;
// main.foo -> unknown name -> the SQLite default, numeric affinity)
const _sqq = await sqliteDb.query(`select cast(name as main.int) as a, cast(name as main.foo) as b from t`)
expectType<typeof _sqq>(toBe<Array<{ a: number; b: number }>>())
