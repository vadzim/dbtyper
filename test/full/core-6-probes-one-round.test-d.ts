// CORE-6, CORE-7 (#143): one round of the parameter probe loop binds every probe it can type (AND / OR, VALUES rows,
// UPDATE SET, ON CONFLICT DO UPDATE SET, IN lists, function arguments); the types and the errors stay those of the
// one-at-a-time loop.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer not null primary key, c0 integer not null, s text not null, n integer);`)
	.database()

// the error the checker reports for a statement and the values the call passes
type Err<S extends string, V extends Record<string, unknown> | readonly unknown[]> = GetQueryError<typeof _db, S, V>

// ✅ SUCCESS: CORE-6 both sides of AND and OR give their parameters a type in one round
const _andOr = await _db.query(`select id from t where s = $1 or c0 = $2 or (n = $3 and s like $4);`, ["a", 1, 2, "b"])
expectType<typeof _andOr>(toBe<Array<{ id: number }>>())

// ❌ ERROR: CORE-6 a wrong value on the right of AND is found
expectType<Err<`select id from t where s = :a and c0 = :b;`, { a: string; b: string }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :b">>(),
)
// @ts-expect-error
await _db.query(`select id from t where s = :a and c0 = :b;`, { a: "x", b: "y" })

// ❌ ERROR: CORE-6 the first position of a parameter gives its type, a later one is checked against it
expectType<Err<`select id from t where c0 = :p and s = :p;`, { p: number }>>(
	toBe<DbtyperError<2500, "Incompatible types in comparison">>(),
)
// @ts-expect-error
await _db.query(`select id from t where c0 = :p and s = :p;`, { p: 1 })

// ✅ SUCCESS: CORE-6 a bound parameter is a peer for another parameter, in either order (#145)
const _bound = await _db.query(`select id from t where c0 = :p0 and :p0 = :p1;`, { p0: 1, p1: 2 })
expectType<typeof _bound>(toBe<Array<{ id: number }>>())
const _boundReverse = await _db.query(`select id from t where :p0 = :p1 and c0 = :p0;`, { p0: 1, p1: 2 })
expectType<typeof _boundReverse>(toBe<Array<{ id: number }>>())

// ❌ ERROR: CORE-6 the second parameter takes the type of the first, a wrong value is found
expectType<Err<`select id from t where :p0 = :p1 and c0 = :p0;`, { p0: number; p1: string }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :p1">>(),
)
// @ts-expect-error
await _db.query(`select id from t where :p0 = :p1 and c0 = :p0;`, { p0: 1, p1: "x" })

// ❌ ERROR: CORE-7 parameters that only meet each other still have no type
expectType<Err<`select id from t where :p0 = :p1;`, { p0: number; p1: number }>>(
	toBe<DbtyperError<2405, "cannot infer the type of parameter :p0; use CAST(:p0 AS …)">>(),
)
// @ts-expect-error
await _db.query(`select id from t where :p0 = :p1;`, { p0: 1, p1: 2 })

// ✅ SUCCESS: CORE-6 the cells of all VALUES rows, nullable columns keep null
const _rows = await _db.query(`insert into t (id, c0, s, n) values ($1, $2, $3, $4), ($5, $6, $7, $8) returning id;`, [
	1,
	2,
	"x",
	null,
	3,
	4,
	"y",
	5,
])
expectType<typeof _rows>(toBe<Array<{ id: number }>>())

// ❌ ERROR: CORE-6 a wrong value in the last VALUES row
expectType<
	Err<
		`insert into t (id, c0, s, n) values ($1, $2, $3, $4), ($5, $6, $7, $8);`,
		[number, number, string, null, number, number, string, string]
	>
>(toBe<DbtyperError<2509, "Incompatible value type for parameter $8">>())
// @ts-expect-error
await _db.query(`insert into t (id, c0, s, n) values ($1, $2, $3, $4), ($5, $6, $7, $8);`, [
	1,
	2,
	"x",
	null,
	3,
	4,
	"y",
	"z",
])

// ✅ SUCCESS: CORE-6 UPDATE SET next to a literal, and WHERE
const _upd = await _db.query(`update t set c0 = 1, s = :s, n = :n where id = :id;`, { s: "x", n: null, id: 1 })
expectType<typeof _upd>(toBe<[]>())

// ✅ SUCCESS: CORE-6 ON CONFLICT DO UPDATE SET
const upsert = `insert into t (id, c0, s) values ($1, $2, $3) on conflict (id) do update set c0 = $4, s = $5, n = $6;`
await _db.query(upsert, [1, 2, "x", 3, "y", null])

// ❌ ERROR: CORE-6 a wrong value in the last DO UPDATE SET assignment
expectType<Err<typeof upsert, [number, number, string, number, string, string]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter $6">>(),
)
// @ts-expect-error
await _db.query(upsert, [1, 2, "x", 3, "y", "z"])

// ✅ SUCCESS: CORE-6 an IN list with a literal and an expression among the parameters
await _db.query(`select id from t where c0 in (1, $1, $2, c0 + $3);`, [1, 2, 3])

// ✅ SUCCESS: CORE-6 every argument of a function call
const _fn = await _db.query(`select substr(s, :a, :b) as x from t;`, { a: 1, b: 2 })
expectType<typeof _fn>(toBe<Array<{ x: string }>>())

// ❌ ERROR: CORE-6 a wrong value for the last function argument
expectType<Err<`select substr(:s, :a, :b) as x from t;`, { s: string; a: number; b: string }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :b">>(),
)
// @ts-expect-error
await _db.query(`select substr(:s, :a, :b) as x from t;`, { s: "q", a: 1, b: "2" })
