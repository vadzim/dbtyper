// SQLT-30, SQLT-31, SQLT-32: SQLite parameter forms, one key per bare name, and the values the drivers bind.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteBigintDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const ddl = `create table users (id integer primary key, name text not null, email text, score real, raw blob);`
const db = sqlMigrations({ driver: sqliteDriver }).apply(ddl).database()
const big = sqlMigrations({ driver: sqliteBigintDriver }).apply(ddl).database()

// SQLT-30: `?`/`?NNN` take an array, `:name`/`@name`/`$name` an object keyed by the bare name
const _at = await db.query(`select name from users where id = @id`, { id: 1 })
expectType<typeof _at>(toBe<Array<{ name: string }>>())
const _colon = await db.query(`select name from users where id = :id`, { id: 1 })
expectType<typeof _colon>(toBe<Array<{ name: string }>>())
const _dollar = await db.query(`select name from users where id = $id`, { id: 1 })
expectType<typeof _dollar>(toBe<Array<{ name: string }>>())
const _numbered = await db.query(`select name from users where id = ?1 or score > ?2`, [1, 2.5])
expectType<typeof _numbered>(toBe<Array<{ name: string }>>())
const _plain = await db.query(`select name from users where id = ? and score > ?`, [1, 2.5])
expectType<typeof _plain>(toBe<Array<{ name: string }>>())
// the type of each value comes from its position
// @ts-expect-error
db.query(`select name from users where id = @id`, { id: "x" })
expectType<GetQueryError<typeof db, `select name from users where id = @id`, { id: string }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :id">>(),
)
// @ts-expect-error
db.query(`select name from users where id = ?1 or score > ?2`, [1, "x"])
expectType<GetQueryError<typeof db, `select name from users where id = ?1 or score > ?2`, [number, string]>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter ?2">>(),
)
// @ts-expect-error
db.query(`select name from users where id = :id`, { other: 1 })
expectType<GetQueryError<typeof db, `select name from users where id = :id`, { other: number }>>(
	toBe<DbtyperError<2400, "Unknown query parameter: id">>(),
)

// SQLT-31: positional and named parameters do not mix; :a, @a and $a are one key and must agree
// @ts-expect-error
db.query(`select name from users where id = ? and name = :n`, [1])
expectType<GetQueryError<typeof db, `select name from users where id = ? and name = :n`, [number]>>(
	toBe<DbtyperError<1007, "Unexpected token at: :">>(),
)
// @ts-expect-error
db.query(`select name from users where id = ? and name = :n`, { n: "a" })
expectType<GetQueryError<typeof db, `select name from users where id = ? and name = :n`, { n: string }>>(
	toBe<DbtyperError<1007, "Unexpected token at: ?">>(),
)
const _sameKey = await db.query(`select name from users where id = :a or id = @a or id = $a`, { a: 1 })
expectType<typeof _sameKey>(toBe<Array<{ name: string }>>())
// @ts-expect-error
db.query(`select name from users where id = :a or name = @a`, { a: 1 })
expectType<GetQueryError<typeof db, `select name from users where id = :a or name = @a`, { a: number }>>(
	toBe<DbtyperError<2500, "Incompatible types in comparison">>(),
)

// SQLT-32: number, bigint (where an integer is expected), string, Uint8Array and null (where nullable) are values
const _upd = await db.query(`update users set email = :e where id = :id`, { e: null, id: 1n })
expectType<typeof _upd>(toBe<[]>())
const _text = await db.query(`select id from users where name = :n`, { n: "a" })
expectType<typeof _text>(toBe<Array<{ id: number }>>())
const _blob = await db.query(`select id from users where raw = :b`, { b: new Uint8Array(2) })
expectType<typeof _blob>(toBe<Array<{ id: number }>>())
const _real = await db.query(`select id from users where score > :s`, { s: 1.5 })
expectType<typeof _real>(toBe<Array<{ id: number }>>())
const _bigMode = await big.query(`select id from users where id = :id`, { id: 1 })
expectType<typeof _bigMode>(toBe<Array<{ id: bigint }>>())
const _bigVal = await big.query(`select id from users where id = :id`, { id: 1n })
expectType<typeof _bigVal>(toBe<Array<{ id: bigint }>>())
// @ts-expect-error: Date is not bound by either driver
db.query(`update users set email = :e where id = :id`, { e: new Date(), id: 1 })
expectType<GetQueryError<typeof db, `update users set email = :e where id = :id`, { e: Date; id: number }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :e">>(),
)
// @ts-expect-error: boolean is not bound by either driver
db.query(`select name from users where id = :id`, { id: true })
expectType<GetQueryError<typeof db, `select name from users where id = :id`, { id: boolean }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :id">>(),
)
// @ts-expect-error: null only where nullable
db.query(`select id from users where name = :n`, { n: null })
expectType<GetQueryError<typeof db, `select id from users where name = :n`, { n: null }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>(),
)
// @ts-expect-error: bigint only where an integer is expected
db.query(`select id from users where name = :n`, { n: 1n })
expectType<GetQueryError<typeof db, `select id from users where name = :n`, { n: bigint }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>(),
)
// @ts-expect-error: objects are not bound
db.query(`select id from users where name = :n`, { n: {} })
expectType<GetQueryError<typeof db, `select id from users where name = :n`, { n: {} }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :n">>(),
)
