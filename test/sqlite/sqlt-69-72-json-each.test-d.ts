// SQLT-69 … SQLT-72: `json_each` / `json_tree` as FROM items (Checks in verification/sqlite.md).
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteBigintDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const ddl = `create table c (id integer primary key, tags text not null);`
const db = sqlMigrations({ driver: sqliteDriver }).apply(ddl).database()
const big = sqlMigrations({ driver: sqliteBigintDriver }).apply(ddl).database()

type JsonType = "null" | "true" | "false" | "integer" | "real" | "text" | "array" | "object"
type Row = {
	key: number | string | null
	value: number | string | null
	type: JsonType
	atom: number | string | null
	id: number
	parent: number | null
	fullkey: string
	path: string
}

// Check SQLT-69
const _star = await db.query(`select * from json_each('[1]')`)
expectType<typeof _star>(toBe<Row[]>())
const _named = await db.query(`select json_each.value from json_each('[1]')`)
expectType<typeof _named>(toBe<{ value: number | string | null }[]>())
const _comma = await db.query(`select j.value as v from c, json_each(c.tags) as j`)
expectType<typeof _comma>(toBe<{ v: number | string | null }[]>())
// @ts-expect-error
await db.query(`select j.nope from c, json_each(c.tags) j`)
expectType<GetQueryError<typeof db, `select j.nope from c, json_each(c.tags) j`>>(
	toBe<DbtyperError<2307, "Unknown qualified column j.nope">>(),
)
// the hidden columns `json` and `root` are "Not yet"
// @ts-expect-error
await db.query(`select j.root from c, json_each(c.tags) j`)
expectType<GetQueryError<typeof db, `select j.root from c, json_each(c.tags) j`>>(
	toBe<DbtyperError<2307, "Unknown qualified column j.root">>(),
)
// SQLT-69: `j.*`, a bare alias, json_tree has the same columns
const _jstar = await db.query(`select c.tags, j.* from c, json_tree(c.tags) j`)
expectType<typeof _jstar>(toBe<{ [K in "tags" | keyof Row]: K extends keyof Row ? Row[K] : string }[]>())
const _bare = await db.query(`select key, value, type, atom, id, parent, fullkey, path from json_tree(?)`, ["[1]"])
expectType<typeof _bare>(toBe<Row[]>())

// SQLT-70: big-integer mode
const _big = await big.query(`select key, value, atom, id, parent, type, fullkey from json_tree(?)`, ["[1]"])
expectType<typeof _big>(
	toBe<
		{
			key: bigint | string | null
			value: bigint | number | string | null
			atom: bigint | number | string | null
			id: bigint
			parent: bigint | null
			type: JsonType
			fullkey: string
		}[]
	>(),
)

// Check SQLT-71
const _on = await db.query(`select c.id, j.value from c join json_each(c.tags, '$.a') j on j.type = 'text'`)
expectType<typeof _on>(toBe<{ id: number; value: number | string | null }[]>())
const _params = await db.query(`select value from json_each(?, ?)`, ["[1]", "$"])
expectType<typeof _params>(toBe<{ value: number | string | null }[]>())
// @ts-expect-error a parameter of json_each is a string
await db.query(`select value from json_each(?, ?)`, ["[1]", 1])
const _named2 = await db.query(`select value from json_each(:doc)`, { doc: "[1]" })
expectType<typeof _named2>(toBe<{ value: number | string | null }[]>())
// @ts-expect-error
await db.query(`select value from json_each(:doc)`, { doc: 1 })
// @ts-expect-error
await db.query(`select value from json_each(c.tags)`)
expectType<GetQueryError<typeof db, `select value from json_each(c.tags)`>>(
	toBe<DbtyperError<2307, "Unknown qualified column c.tags">>(),
)
// `json` may have any type
const _num = await db.query(`select value from c, json_each(c.id)`)
expectType<typeof _num>(toBe<{ value: number | string | null }[]>())

// Check SQLT-72
const _left = await db.query(`select c.id, j.key from c left join json_each(c.tags) j on true`)
expectType<typeof _left>(toBe<{ id: number; key: number | string | null }[]>())
const _leftId = await db.query(`select j.id from c left join json_each(c.tags) j on true`)
expectType<typeof _leftId>(toBe<{ id: number | null }[]>())
const _cross = await db.query(`select t.fullkey from c cross join json_tree(c.tags) t`)
expectType<typeof _cross>(toBe<{ fullkey: string }[]>())
// @ts-expect-error
await db.query(`select c.id from c, c as d`)
expectType<GetQueryError<typeof db, `select c.id from c, c as d`>>(
	toBe<DbtyperError<1115, "Expected alias or join clause after table">>(),
)
// @ts-expect-error
await db.query(`select * from json_each()`)
expectType<GetQueryError<typeof db, `select * from json_each()`>>(
	toBe<DbtyperError<1937, "json_each takes 1 or 2 arguments: json [, path]">>(),
)
// @ts-expect-error
await db.query(`select * from json_tree('[]', '$', 1)`)
expectType<GetQueryError<typeof db, `select * from json_tree('[]', '$', 1)`>>(
	toBe<DbtyperError<1937, "json_tree takes 1 or 2 arguments: json [, path]">>(),
)
// @ts-expect-error
await db.query(`select json_each('[]')`)
expectType<GetQueryError<typeof db, `select json_each('[]')`>>(
	toBe<DbtyperError<3619, "Unknown function: json_each">>(),
)
// a comma before json_each after an aliased table, and several in a row
const _two = await db.query(`select a.value as x, b.value as y from c x, json_each(x.tags) a, json_each(a.value) b`)
expectType<typeof _two>(toBe<{ x: number | string | null; y: number | string | null }[]>())

// "Not yet": a column-alias list after the alias
// @ts-expect-error
await db.query(`select j.a from c, json_each(c.tags) j(a)`)
type _AliasList = GetQueryError<typeof db, `select j.a from c, json_each(c.tags) j(a)`>
expectType<_AliasList extends DbtyperError<number, string> ? true : false>(toBe<true>())

// PostgreSQL: json_tree is no FROM function, and json_each in FROM is "Not yet" (the usual FROM errors)
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table c (id integer primary key, tags text not null);`)
	.database()
// @ts-expect-error
await pg.query(`select * from json_tree('[]')`)
expectType<GetQueryError<typeof pg, `select * from json_tree('[]')`>>(toBe<PgTreeError>())
// @ts-expect-error
await pg.query(`select c.id from c, json_each(c.tags)`)
expectType<GetQueryError<typeof pg, `select c.id from c, json_each(c.tags)`>>(
	toBe<DbtyperError<1115, "Expected alias or join clause after table">>(),
)
type PgTreeError = DbtyperError<2200, "Unknown table json_tree in FROM">
