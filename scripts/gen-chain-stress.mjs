// node scripts/gen-chain-stress.mjs -> the #192 stress tests of test/stress (long migration chains):
// chain-200-applies-60-tables, rename-column-mass, chain-repeated-ddl-postgres, chain-repeated-ddl-sqlite.
// The first is a SQLite migration chain of 200 applies over 60 tables, shaped like a real application's history:
// CREATE TABLE with mixed-case columns, foreign keys and indexes, ADD / DROP / RENAME COLUMN, table rebuilds
// (create new, INSERT ... SELECT, drop old, rename), triggers, UPDATE / DELETE / INSERT ... SELECT with WHERE.
// All names are invented. The file ends with queries whose row types the generator knows from its own model of
// the schema, so a chain that lost its types (raw TS2589 in the middle) fails the test.
import fs from "node:fs"
import path from "node:path"

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..")
const TABLES = 60

// prettier-ignore
const NOUNS = ["anchor", "basket", "candle", "dynamo", "ember", "falcon", "garnet", "harbor", "island", "jigsaw", "kettle", "lantern", "meadow", "nectar", "orchid", "pebble", "quiver", "ribbon", "saddle", "thimble", "umbra", "velvet", "walnut", "yonder", "zephyr", "acorn", "bramble", "cobalt", "dapple", "easel"]
const STEMS = [
	"owner",
	"sort",
	"label",
	"batch",
	"sync",
	"token",
	"draft",
	"pinned",
	"source",
	"target",
	"retry",
	"quota",
]
const TAILS = ["Id", "Rank", "Text", "Count", "At", "Flag", "Size", "Kind", "Note", "Ratio"]
/** The SQL type and the TypeScript type of a column by the tail of its name. */
const TYPE_OF_TAIL = {
	Id: "INTEGER",
	Rank: "INTEGER",
	Text: "TEXT",
	Count: "INTEGER",
	At: "INTEGER",
	Flag: "INTEGER",
	Size: "INTEGER",
	Kind: "TEXT",
	Note: "TEXT",
	Ratio: "REAL",
}
const TS_TYPE = { INTEGER: "number", TEXT: "string", REAL: "number" }

function gen(N) {
	// mulberry32: the same file on every run
	let seed = 192
	const rnd = () => {
		seed = (seed + 0x6d2b79f5) | 0
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
	const int = n => Math.floor(rnd() * n)
	const pick = list => list[int(list.length)]

	/** The model: table name -> columns in declaration order. */
	const tables = new Map()
	const tableName = i => NOUNS[i % NOUNS.length] + (i < NOUNS.length ? "s" : "_logs")
	let serial = 0
	const freshColumn = (cols, notNull = false) => {
		for (;;) {
			const tail = pick(TAILS)
			const name = pick(STEMS) + tail
			if (cols.some(c => c.name.toLowerCase() === name.toLowerCase())) continue
			return { name, type: TYPE_OF_TAIL[tail], notNull }
		}
	}
	const columnSql = c =>
		`${c.name} ${c.type}${c.notNull ? (c.type === "TEXT" ? " NOT NULL DEFAULT ''" : " NOT NULL DEFAULT 0") : ""}`
	const createSql = (name, cols, refs) =>
		`CREATE TABLE ${name} (id INTEGER PRIMARY KEY, ${cols.map(columnSql).join(", ")}${refs}); `
	const nonEmpty = () => [...tables.keys()].filter(t => tables.get(t).length > 0)
	const someTable = () => pick(nonEmpty())
	const literal = c => (c.type === "TEXT" ? "'x'" : "1")

	const kinds = {
		create(count) {
			let sql = ""
			for (let k = 0; k < count && tables.size < TABLES; k++) {
				const name = tableName(tables.size)
				const cols = []
				const width = 4 + int(7)
				for (let c = 0; c < width; c++) cols.push(freshColumn(cols, rnd() < 0.3))
				const parents = [...tables.keys()]
				let refs = ""
				if (parents.length > 0 && rnd() < 0.6) {
					const parent = pick(parents)
					cols.push({ name: `${parent}Ref`, type: "INTEGER", notNull: false })
					refs = `, CONSTRAINT ${name}_fk FOREIGN KEY (${parent}Ref) REFERENCES ${parent}(id) ON DELETE CASCADE`
				}
				sql += createSql(name, cols, refs)
				sql += `CREATE INDEX ${name}_by_${cols[0].name} ON ${name} (${cols[0].name}); `
				tables.set(name, cols)
			}
			return sql
		},
		addColumns() {
			const t = someTable()
			const cols = tables.get(t)
			let sql = ""
			for (let k = 1 + int(4); k > 0; k--) {
				const c = freshColumn(cols)
				cols.push(c)
				sql += `ALTER TABLE ${t} ADD COLUMN ${columnSql(c)}; `
			}
			return sql
		},
		renameColumns() {
			let sql = ""
			for (let k = 1 + int(3); k > 0; k--) {
				const t = someTable()
				const cols = tables.get(t)
				const old = pick(cols)
				const renamed = `${old.name.replace(/V\d+$/, "")}V${++serial}`
				sql += `ALTER TABLE ${t} RENAME COLUMN ${old.name} TO ${renamed}; `
				old.name = renamed
			}
			return sql
		},
		rebuild() {
			const t = someTable()
			const kept = tables.get(t).filter(() => rnd() < 0.8)
			if (kept.length === 0) kept.push(tables.get(t)[0])
			const cols = kept.map(c => ({ ...c }))
			cols.push(freshColumn(cols))
			const names = kept.map(c => c.name).join(", ")
			tables.set(t, cols)
			return (
				createSql(`${t}_new`, cols, "") +
				`INSERT INTO ${t}_new (id, ${names}) SELECT id, ${names} FROM ${t}; ` +
				`DROP TABLE ${t}; ALTER TABLE ${t}_new RENAME TO ${t}; `
			)
		},
		dml() {
			const t = someTable()
			const c = pick(tables.get(t))
			const d = pick(tables.get(t))
			return (
				`UPDATE ${t} SET ${c.name} = ${literal(c)} WHERE ${c.name} IS NULL; ` +
				`DELETE FROM ${t} WHERE ${d.name} IS NULL OR ${d.name} != ${literal(d)}; `
			)
		},
		indexAndTrigger() {
			const t = someTable()
			const u = someTable()
			const c = pick(tables.get(t))
			const d = pick(tables.get(u))
			const n = ++serial
			return (
				`CREATE INDEX ${t}_idx${n} ON ${t} (${c.name}, id); ` +
				`CREATE TRIGGER ${t}_ad${n} AFTER DELETE ON ${t} BEGIN DELETE FROM ${u} WHERE ${d.name} = old.id; END; `
			)
		},
		insertSelect() {
			// copies rows between two tables: columns are paired by type
			const from = someTable()
			const to = someTable()
			const pairs = []
			const free = [...tables.get(from)]
			for (const target of tables.get(to)) {
				const at = free.findIndex(c => c.type === target.type)
				if (at >= 0 && pairs.length < 4) pairs.push([target, free.splice(at, 1)[0]])
			}
			if (pairs.length === 0) return kinds.dml()
			const w = pairs[0][1]
			return (
				`INSERT INTO ${to} (${pairs.map(p => p[0].name).join(", ")}) SELECT ${pairs.map(p => p[1].name).join(", ")} ` +
				`FROM ${from} WHERE ${w.name} IS NULL OR ${w.name} != ${literal(w)}; `
			)
		},
		dropColumn() {
			const t = someTable()
			const cols = tables.get(t)
			if (cols.length < 3) return kinds.addColumns()
			const [gone] = cols.splice(int(cols.length), 1)
			return `ALTER TABLE ${t} DROP COLUMN ${gone.name}; `
		},
		addNotNull() {
			const t = someTable()
			const cols = tables.get(t)
			const c = freshColumn(cols, true)
			cols.push(c)
			return `ALTER TABLE ${t} ADD COLUMN ${columnSql(c)}; UPDATE ${t} SET ${c.name} = ${literal(c)} WHERE id IS NOT NULL; `
		},
	}
	const rotation = [
		"addColumns",
		"renameColumns",
		"rebuild",
		"dml",
		"indexAndTrigger",
		"insertSelect",
		"dropColumn",
		"addNotNull",
	]

	// every third apply creates tables until there are TABLES of them; a short chain creates several per apply
	const perCreate = Math.ceil(TABLES / Math.ceil(N / 3))
	const applies = []
	let turn = 0
	for (let i = 0; i < N; i++) {
		const sql =
			i % 3 === 0 && tables.size < TABLES ? kinds.create(perCreate) : kinds[rotation[turn++ % rotation.length]]()
		applies.push(sql.trim())
	}

	const out = []
	out.push(
		`// Generated by scripts/gen-chain-stress.mjs (do not edit by hand). #192: a chain of ${N} applies over ${tables.size} tables`,
		`// typechecks (no TS2589) and keeps its types to the end; before the fix a chain like this broke at about 20 applies.`,
		`import { sqlMigrations } from "../../src/core/sql-database.ts"`,
		`import { sqliteDriver } from "../test-utils/test-databases.ts"`,
		`import { expectType, toBe } from "../test-utils/type-test-utils.ts"`,
		``,
		`const chain = sqlMigrations({ driver: sqliteDriver })`,
	)
	for (const sql of applies) out.push(`\t.apply(\`${sql}\`)`)
	out.push(``, `const db = chain.database()`)
	// the first table, the last one, and the table with the most columns
	const names = [...tables.keys()]
	const widest = names.reduce((a, b) => (tables.get(b).length > tables.get(a).length ? b : a))
	const checked = [...new Set([names[0], names[names.length - 1], widest])]
	checked.forEach((t, i) => {
		const cols = tables.get(t)
		out.push(
			``,
			`const _rows${i} = await db.query(\`select id, ${cols.map(c => c.name).join(", ")} from ${t}\`)`,
			`expectType<typeof _rows${i}>(`,
			`\ttoBe<Array<{ id: number; ${cols.map(c => `${c.name}: ${TS_TYPE[c.type]}${c.notNull ? "" : " | null"}`).join("; ")} }>>(),`,
			`)`,
		)
	})
	return out.join("\n") + "\n"
}

/** One migration that renames four columns in each of ten tables: it hit TS2589 even alone (#192). */
function genMassRename() {
	const names = NOUNS.slice(0, 10).map(n => `${n}s`)
	const cols = [
		"ownerId INTEGER",
		"sortRank INTEGER",
		"labelText TEXT",
		"batchCount INTEGER",
		"syncAt INTEGER",
		"tokenFlag INTEGER",
		"draftSize INTEGER",
		"pinnedKind TEXT",
	]
	const renames = [
		["ownerId", "holderId"],
		["sortRank", "sortOrder"],
		["labelText", "captionText"],
		["syncAt", "syncedAt"],
	]
	const create = names.map(t => `CREATE TABLE ${t} (id INTEGER PRIMARY KEY, ${cols.join(", ")});`).join(" ")
	const rename = names.flatMap(t => renames.map(([a, b]) => `ALTER TABLE ${t} RENAME COLUMN ${a} TO ${b};`)).join(" ")
	const row =
		"id: number; holderId: number | null; sortOrder: number | null; captionText: string | null; batchCount: number | null; syncedAt: number | null; tokenFlag: number | null; draftSize: number | null; pinnedKind: string | null"
	return [
		`// Generated by scripts/gen-chain-stress.mjs (do not edit by hand). #192: one migration that renames four columns in`,
		`// each of ten tables (${names.length * renames.length} RENAME COLUMN) ended in raw TS2589 even as the only migration after the CREATE TABLEs.`,
		`// It must typecheck; a renamed column keeps its place, its type and the spelling it was written with.`,
		`import { sqlMigrations } from "../../src/core/sql-database.ts"`,
		`import { sqliteDriver } from "../test-utils/test-databases.ts"`,
		`import { expectType, toBe } from "../test-utils/type-test-utils.ts"`,
		``,
		`const db = sqlMigrations({ driver: sqliteDriver })`,
		`\t.apply(\`${create}\`)`,
		`\t.apply(\`${rename}\`)`,
		`\t.database()`,
		``,
		`const _first = await db.query("select * from ${names[0]}")`,
		`expectType<typeof _first>(toBe<Array<{ ${row} }>>())`,
		`const _last = await db.query("select holderId, captionText, pinnedKind from ${names[9]} where syncedAt is not null")`,
		`expectType<typeof _last>(toBe<Array<{ holderId: number | null; captionText: string | null; pinnedKind: string | null }>>())`,
		``,
	].join("\n")
}

/**
 * One statement kind repeated REPEATS times on one small schema, a chain per kind. A kind that makes the schema type
 * point at its previous state adds to TypeScript's instantiation depth with every repetition and ends in TS2589
 * (limit 100) long before REPEATS: the 200-apply chain above cannot tell which kind leaks, this one does (#192).
 */
const REPEATS = 40
const REPEATED = {
	postgres: {
		driver: "mockDriver",
		base: "create type mood as enum ('a','b'); create domain posint as int check (value > 0); create table t (id serial primary key, m mood, n int, s text, p posint); create table u (id int primary key, t_id int references t(id), s text); create schema app;",
		kinds: {
			addColumn: i => `alter table t add column c${i} int;`,
			addColumnNotNullDefault: i => `alter table t add column c${i} text not null default 'x';`,
			addEnumColumn: i => `alter table t add column c${i} mood;`,
			addEnumArrayColumn: i => `alter table t add column c${i} mood[] not null;`,
			addDomainColumn: i => `alter table t add column c${i} posint;`,
			addDropColumn: i => `alter table t add column c${i} int; alter table t drop column c${i};`,
			renameColumn: i => `alter table t rename column ${i ? `n${i - 1}` : "n"} to n${i};`,
			alterColumnType: i => `alter table t add column c${i} int; alter table t alter column c${i} type bigint;`,
			setNotNull: i => `alter table t add column c${i} int; alter table t alter column c${i} set not null;`,
			setDropNotNull: i =>
				`alter table t alter column n ${i % 2 ? "drop" : "set"} not null; alter table u add column c${i} int;`,
			setDefault: i => `alter table t add column c${i} int; alter table t alter column c${i} set default 1;`,
			addConstraint: i => `alter table t add constraint k${i} unique (n, s);`,
			addDropConstraint: i =>
				`alter table t add constraint k${i} check (n > 0); alter table t drop constraint k${i}; alter table u add column c${i} int;`,
			addPrimaryKey: i => `create table pk${i} (a int, b text); alter table pk${i} add primary key (a);`,
			renameTable: i => `alter table ${i ? `u${i - 1}` : "u"} rename to u${i};`,
			createTable: i =>
				`create table n${i} (id serial primary key, m mood not null, label text default 'x', t_id int references t(id));`,
			createTableInSchema: i => `create table app.n${i} (id int primary key, m mood, p posint);`,
			createView: i => `create view v${i} as select id, m, n, s from t where n is not null;`,
			createViewOnView: i => `create view v${i} as select id, m, n from ${i ? `v${i - 1}` : "t"};`,
			createOrReplaceView: i => `create or replace view v as select id, m, n, s, ${i} as k from t;`,
			createType: i => `create type e${i} as enum ('x', 'y');`,
			alterTypeAddValue: i => `alter type mood add value 'v${i}';`,
			alterTypeRenameValue: i => `alter type mood rename value '${i ? `r${i - 1}` : "a"}' to 'r${i}';`,
			dropTypeCascade: i =>
				`create type e${i} as enum ('x'); alter table t add column c${i} e${i}; drop type e${i} cascade; alter table u add column c${i} int;`,
			createDomain: i => `create domain d${i} as text not null;`,
			domainOfEnumColumn: i => `create domain d${i} as mood; alter table t add column c${i} d${i};`,
			compositeTypeColumn: i =>
				`create type comp${i} as (a int, b text); alter table t add column c${i} comp${i};`,
			createSchema: i => `create schema s${i}; create table s${i}.x (id int, m mood);`,
		},
	},
	sqlite: {
		driver: "sqliteDriver",
		base: "create table t (id integer primary key, n integer, s text, mixedCase text); create table u (id integer primary key, t_id integer references t(id), s text);",
		kinds: {
			addColumn: i => `alter table t add column c${i} integer;`,
			addMixedCaseColumn: i => `alter table t add column camelCol${i} text;`,
			addDropMixedCaseColumn: i =>
				`alter table t add column Extra${i} integer; alter table t drop column Extra${i}; alter table u add column c${i} integer;`,
			renameColumn: i => `alter table t rename column ${i ? `n${i - 1}` : "n"} to n${i};`,
			renameMixedCaseColumn: i =>
				`alter table t rename column ${i ? `mixedCase${i - 1}` : "mixedCase"} to mixedCase${i};`,
			renameTable: i => `alter table ${i ? `u${i - 1}` : "u"} rename to u${i};`,
			rebuildTable: i =>
				`create table t_new (id integer primary key, n integer, s text, mixedCase text, gen${i} integer); insert into t_new (id, n, s, mixedCase) select id, n, s, mixedCase from t; drop table t; alter table t_new rename to t;`,
			createTable: i =>
				`create table n${i} (id integer primary key, ownerId integer not null, labelText text default 'x', t_id integer references t(id));`,
			createWithoutRowid: i => `create table n${i} (keyName text primary key, valueText text) without rowid;`,
			createTempTable: i => `create temp table tmp${i} (id integer, someValue text);`,
			createView: i => `create view v${i} as select id, n, mixedCase from t where n is not null;`,
		},
	},
}

function genRepeated(dialect) {
	const { driver, base, kinds } = REPEATED[dialect]
	const out = [
		`// Generated by scripts/gen-chain-stress.mjs (do not edit by hand). #192: every schema-changing statement kind, repeated`,
		`// ${REPEATS} times on one small schema (a chain per kind). A kind that makes the schema type point at its previous state`,
		`// deepens every later instantiation and ends in TS2589 well before ${REPEATS} repetitions; each chain must typecheck and keep its types.`,
		`import { sqlMigrations } from "../../src/core/sql-database.ts"`,
		`import { ${driver} } from "../test-utils/test-databases.ts"`,
		`import { expectType, toBe } from "../test-utils/type-test-utils.ts"`,
		``,
		`const base = sqlMigrations({ driver: ${driver} }).apply(\`${base}\`)`,
	]
	for (const [kind, statement] of Object.entries(kinds)) {
		out.push(``, `const _${kind} = await base`)
		for (let i = 0; i < REPEATS; i++) out.push(`\t.apply(\`${statement(i)}\`)`)
		out.push(
			`\t.database()`,
			`\t.query("select id, s from t")`,
			`expectType<typeof _${kind}>(toBe<Array<{ id: number; s: string | null }>>())`,
		)
	}
	return out.join("\n") + "\n"
}

if (process.argv[2]) {
	// a chain of another length, for measurements: node scripts/gen-chain-stress.mjs 50 /tmp/chain-50.ts
	fs.writeFileSync(process.argv[3], gen(Number(process.argv[2])))
} else {
	const files = {
		"chain-200-applies-60-tables.test-d.ts": gen(200),
		"rename-column-mass.test-d.ts": genMassRename(),
		"chain-repeated-ddl-postgres.test-d.ts": genRepeated("postgres"),
		"chain-repeated-ddl-sqlite.test-d.ts": genRepeated("sqlite"),
	}
	for (const [name, text] of Object.entries(files)) {
		fs.writeFileSync(path.join(root, "test/stress", name), text)
		console.log(`wrote test/stress/${name}`)
	}
}
