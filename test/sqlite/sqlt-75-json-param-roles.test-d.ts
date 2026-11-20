// SQLT-75: a parameter that is an argument of a JSON function takes its type from the argument's role.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const db = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table users (id integer primary key, name text not null, email text);`)
	.database()

// Check SQLT-75: JSON text and path roles are `string`
const _patch = await db.query(`select json_patch(email, :patch) as j from users`, { patch: "{}" })
expectType<typeof _patch>(toBe<Array<{ j: string | null }>>())
// @ts-expect-error a JSON text is a string
await db.query(`select json_patch(email, :patch) as j from users`, { patch: 1 })
expectType<GetQueryError<typeof db, `select json_patch(email, :patch) as j from users`, { patch: number }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :patch">>(),
)
const _extract = await db.query(`select json_extract(:doc, :path) as v`, { doc: "[1]", path: "$[0]" })
expectType<typeof _extract>(toBe<Array<{ v: number | string | Uint8Array | null }>>())
// @ts-expect-error
await db.query(`select json_extract(:doc, :path) as v`, { doc: "[1]", path: 1 })
const _many = await db.query(
	`select json_remove(email, :p1, :p2) as r, json_type(email, :p3) as t, json_array_length(:d, :p4) as n, json_valid(:x) as ok from users`,
	{ p1: "a", p2: "b", p3: "c", d: "[]", p4: "$", x: "{}" },
)
expectType<typeof _many>(toBe<Array<{ r: string | null; t: string | null; n: number; ok: number }>>())
// @ts-expect-error every one is a string
await db.query(`select json_remove(email, :p1, :p2) as r from users`, { p1: "a", p2: 2 })
// @ts-expect-error
await db.query(`select json_valid(:x) as ok from users`, { x: 2 })

// values of json_set / json_insert / json_replace, paths in between
await db.query(`update users set email = json_set(email, '$.a', :v, :p, :w) where id = 1`, { v: 1, p: "$.b", w: null })
await db.query(`update users set email = json_set(email, '$.a', :v, :p, :w) where id = 1`, { v: 1n, p: "$.b", w: "x" })
await db.query(`update users set email = json_insert(email, '$.a', :v, :p, :w) where id = 1`, { v: 1, p: "$.b", w: null })
await db.query(`update users set email = json_replace(email, '$.a', :v, :p, :w) where id = 1`, { v: 1, p: "$.b", w: null })
// @ts-expect-error the 4th argument is a path
await db.query(`update users set email = json_set(email, '$.a', :v, :p, :w) where id = 1`, { v: 1, p: 1, w: null })
// @ts-expect-error a blob is no JSON value
await db.query(`update users set email = json_set(email, '$.a', :v) where id = 1`, { v: new Uint8Array(1) })
expectType<GetQueryError<typeof db, `update users set email = json_set(email, '$.a', :v) where id = 1`, { v: Uint8Array }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :v">>(),
)
// @ts-expect-error a boolean is no JSON value
await db.query(`update users set email = json_insert(email, '$.a', :v) where id = 1`, { v: true })
expectType<GetQueryError<typeof db, `update users set email = json_insert(email, '$.a', :v) where id = 1`, { v: boolean }>>(
	toBe<DbtyperError<2509, "Incompatible value type for parameter :v">>(),
)
// @ts-expect-error
await db.query(`update users set email = json_replace(email, '$.a', :v) where id = 1`, { v: new Uint8Array(1) })

// labels and values
const _obj = await db.query(
	`select json_object(:k, :v, 'b', 2) as o, json_array(:a, 1) as a, json_quote(:q) as q`,
	{ k: "key", v: 1, a: "x", q: null },
)
expectType<typeof _obj>(toBe<Array<{ o: string; a: string; q: string }>>())
await db.query(`select json_object(:k, :v, :k2, :v2) as o`, { k: "a", v: 1, k2: "b", v2: 2n })
// @ts-expect-error a label is a string
await db.query(`select json_object(:k, :v) as o`, { k: 1, v: 1 })
// @ts-expect-error a value is not a blob
await db.query(`select json_array(:a, 1) as a`, { a: new Uint8Array(1) })
const _grp = await db.query(`select json_group_object(name, :g) as go, json_group_array(:h) as ga from users`, {
	g: 1,
	h: "x",
})
expectType<typeof _grp>(toBe<Array<{ go: string; ga: string }>>())
// @ts-expect-error
await db.query(`select json_group_array(:h) as ga from users`, { h: true })
// @ts-expect-error a label is a string
await db.query(`select json_group_object(:l, name) as go from users`, { l: 1 })
