// #195 against both real SQLite drivers: what the type side (test/sqlite/sqlite-compat-195.test-d.ts) now accepts runs,
// and gives the values it is typed as. ALTER COLUMN … SET / DROP NOT NULL needs SQLite 3.53 or later.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { DatabaseSync } from "node:sqlite"
import { describe, test } from "node:test"

const require = createRequire(import.meta.url)
const BetterSqlite3 = require("better-sqlite3") as new (path: string) => {
	prepare(sql: string): { all(): unknown[] }
	exec(sql: string): void
}

type Db = { exec(sql: string): void; prepare(sql: string): { all(): unknown[] } }

const engines: Array<[string, () => Db]> = [
	["better-sqlite3", () => new BetterSqlite3(":memory:")],
	["node:sqlite", () => new DatabaseSync(":memory:") as unknown as Db],
]

const rows = (db: Db, sql: string) =>
	db
		.prepare(sql)
		.all()
		.map(r => ({ ...(r as object) }))

for (const [name, open] of engines) {
	describe(name, () => {
		test("NUMERIC affinity compares with text and numbers and takes both", () => {
			const db = open()
			db.exec(`create table items (id string primary key, n number);
				insert into items values ('a', 1), (2, 'two');
				create table t (x text);
				insert into t select id from items;`)
			assert.deepEqual(rows(db, `select id from items where id = 'a' or id = 2 order by n`), [
				{ id: "a" },
				{ id: 2 },
			])
			assert.deepEqual(rows(db, `select id from items where id in ('a', 3)`), [{ id: "a" }])
			assert.deepEqual(rows(db, `select x from t order by x`), [{ x: "2" }, { x: "a" }])
		})

		test("a single-quoted column name and a bare-name DEFAULT", () => {
			const db = open()
			db.exec(`create table b ('Order' integer not null, kind text default plain);
				alter table b add column source text not null default standard;
				insert into b ('Order') values (1);`)
			assert.deepEqual(rows(db, `select * from b`), [{ Order: 1, kind: "plain", source: "standard" }])
		})

		test("ALTER COLUMN … SET / DROP NOT NULL (SQLite 3.53+)", () => {
			const db = open()
			db.exec(`create table c (a integer); alter table c alter column a set not null;`)
			assert.throws(() => db.exec(`insert into c values (null)`), /NOT NULL constraint failed/)
			db.exec(`alter table c alter a drop not null; insert into c values (null);`)
			assert.deepEqual(rows(db, `select a from c`), [{ a: null }])
		})
	})
}
