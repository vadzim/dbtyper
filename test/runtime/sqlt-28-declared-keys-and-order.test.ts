// SQLT-28 (#151) and #150 against both real SQLite drivers: the key of a column is its declared name whatever case the
// query uses, and `INSERT … VALUES` / `INSERT … SELECT *` without a column list go by the CREATE TABLE order.
// The type side of the same cases: test/full/schema-shape-175-batch1.test-d.ts.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { describe, test } from "node:test"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => {
	prepare(sql: string): { all(): unknown[] }
	exec(sql: string): void
}

const schema = `create table users (id integer primary key, name text not null, Mixed text, "Quoted" integer);
create table y (id integer primary key, user_id integer not null, title text);
insert into users (name, mixed, quoted) values ('ann', 'm', 1);
insert into y values (1, 2, 't');
insert into y (id, user_id, title) select id + 1, user_id, title from y;`

type Db = { exec(sql: string): void; prepare(sql: string): { all(): unknown[] } }

const engines: Array<[string, () => Db]> = [
	["better-sqlite3", () => new BetterSqlite3(":memory:")],
	["node:sqlite", () => new DatabaseSync(":memory:") as unknown as Db],
]

for (const [name, open] of engines) {
	describe(name, () => {
		test("SQLT-28: a column is keyed by its declared name", () => {
			const db = open()
			db.exec(schema)
			const [row] = db.prepare(`select MIXED, users.quoted, "ID", NAME from users`).all() as [object]
			assert.deepEqual(Object.keys(row), ["Mixed", "Quoted", "id", "name"])
			const [star] = db.prepare(`select * from users`).all() as [object]
			assert.deepEqual(Object.keys(star), ["id", "name", "Mixed", "Quoted"])
		})

		test("#150: positional INSERT follows the CREATE TABLE order", () => {
			const db = open()
			db.exec(schema)
			const rows = db.prepare(`select id, user_id, title from y order by id`).all() as object[]
			assert.deepEqual(
				rows.map(r => ({ ...r })),
				[
					{ id: 1, user_id: 2, title: "t" },
					{ id: 2, user_id: 2, title: "t" },
				],
			)
		})
	})
}
