// CORE-6, CORE-7 (#143): one round of the parameter probe loop binds every probe it can type (AND / OR, VALUES rows,
// UPDATE SET, ON CONFLICT DO UPDATE SET, IN lists, function arguments); the types and the errors stay those of the
// one-at-a-time loop.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"

const _db = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (id integer not null primary key, c0 integer not null, s text not null, n integer);`)
	.database()

// ✅ SUCCESS: CORE-6 both sides of AND and OR give their parameters a type in one round
const _andOr = await _db.query(`select id from t where s = $1 or c0 = $2 or (n = $3 and s like $4);`, ["a", 1, 2, "b"])
expectType<typeof _andOr>(toBe<Array<{ id: number }>>())

// ❌ ERROR: CORE-6 a wrong value on the right of AND is found
// @ts-expect-error
await _db.query(`select id from t where s = :a and c0 = :b;`, { a: "x", b: "y" })

// ❌ ERROR: CORE-6 the first position of a parameter gives its type, a later one is checked against it
// @ts-expect-error
await _db.query(`select id from t where c0 = :p and s = :p;`, { p: 1 })

// ❌ ERROR: CORE-7 an operand that only meets a parameter is an error before the probe found after it (as in the
// one-at-a-time loop; #145 may type this)
// @ts-expect-error
await _db.query(`select id from t where :p0 = :p1 and c0 = :p0;`, { p0: 1, p1: "x" })

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
// @ts-expect-error
await _db.query(upsert, [1, 2, "x", 3, "y", "z"])

// ✅ SUCCESS: CORE-6 an IN list with a literal and an expression among the parameters
await _db.query(`select id from t where c0 in (1, $1, $2, c0 + $3);`, [1, 2, 3])

// ✅ SUCCESS: CORE-6 every argument of a function call
const _fn = await _db.query(`select substr(s, :a, :b) as x from t;`, { a: 1, b: 2 })
expectType<typeof _fn>(toBe<Array<{ x: string }>>())

// ❌ ERROR: CORE-6 a wrong value for the last function argument
// @ts-expect-error
await _db.query(`select substr(:s, :a, :b) as x from t;`, { s: "q", a: 1, b: "2" })
