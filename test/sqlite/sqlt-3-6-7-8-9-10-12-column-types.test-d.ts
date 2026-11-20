// SQLT-3, SQLT-4, SQLT-6, SQLT-7, SQLT-8, SQLT-9, SQLT-10, SQLT-12: SQLite column types follow affinity.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver, sqliteBigintDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table users (id integer primary key, name text not null, email text, score real, avatar blob);`

const db = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()

// SQLT-3: storage classes
const _users = await db.query(`select id, name, score, avatar from users`)
expectType<typeof _users>(toBe<Array<{ id: number; name: string; score: number | null; avatar: Uint8Array | null }>>())

// SQLT-4: big-integer mode
const bigDb = sqlMigrations({ driver: sqliteBigintDriver }).apply(schema).database()
const _big = await bigDb.query(`select id, score from users`)
expectType<typeof _big>(toBe<Array<{ id: bigint; score: number | null }>>())

// SQLT-6, SQLT-7: affinity by name (bigint → INTEGER, varchar → TEXT, double precision → REAL, decimal → NUMERIC, no type → any)
const affinities = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table t (a bigint not null, b varchar(10) not null, c double precision not null, d decimal(10,2) not null, e not null, f unsigned big int not null, g clob not null, h float not null);`,
	)
	.database()
const _aff = await affinities.query(`select a, b, c, d, e, f, g, h from t`)
expectType<typeof _aff>(
	toBe<
		Array<{
			a: number
			b: string
			c: number
			d: number | string
			e: number | string | Uint8Array
			f: number
			g: string
			h: number
		}>
	>(),
)

// SQLT-8: date-like names are text; SQLT-9: BOOLEAN is number
const texty = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table e (at datetime not null, d date not null, j json not null, ok boolean not null);`)
	.database()
const _texty = await texty.query(`select at, d, j, ok from e`)
expectType<typeof _texty>(toBe<Array<{ at: string; d: string; j: string; ok: number }>>())

// SQLT-9: a comparison is an integer
const _cmp = await db.query(`select name = 'a' as m from users`)
expectType<typeof _cmp>(toBe<Array<{ m: number }>>())

// SQLT-10: a nullable untyped column adds null
const untyped = sqlMigrations({ driver: sqliteDriver }).apply(`create table u (x, y not null);`).database()
const _untyped = await untyped.query(`select x, y from u`)
expectType<typeof _untyped>(toBe<Array<{ x: number | string | Uint8Array | null; y: number | string | Uint8Array }>>())

// SQLT-10 Check (bigint mode): integers come back as `bigint`, reals stay `number`, so the union has both
const untypedBig = sqlMigrations({ driver: sqliteBigintDriver }).apply(`create table u (x, y not null);`).database()
const _untypedBig = await untypedBig.query(`select x, y from u`)
expectType<typeof _untypedBig>(
	toBe<Array<{ x: number | bigint | string | Uint8Array | null; y: number | bigint | string | Uint8Array }>>(),
)

// SQLT-12: CAST gives the type of a column declared so
const _cast = await db.query(`select cast(score as integer) as s, cast(name as varchar(5)) as v from users`)
expectType<typeof _cast>(toBe<Array<{ s: number | null; v: string }>>())
