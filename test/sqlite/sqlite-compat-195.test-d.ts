// #195 (from the Signal Desktop proof #148; spec decisions on dbtyper-spec PR #19, for now A), SQLite only:
// 1. NUMERIC affinity (STRING, NUMBER, any unknown type name) compares with text and numbers and is assigned from and
//    to both: comparisons, IN, LIKE, BETWEEN, CASE, INSERT … VALUES, INSERT … SELECT, UPDATE SET, DEFAULT.
// 2. A single-quoted name in a column definition is the column name (`'order' INTEGER`).
// 3. A bare identifier as DEFAULT is the text default (`DEFAULT standard` = 'standard').
// PostgreSQL is unchanged (end of the file).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const empty = sqlMigrations({ driver: sqliteDriver })
const db = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table items (id string primary key, json text);
		create table emojis_old (shortName string primary key, lastUsage integer);
		create table messages (id string primary key, storyId string, type text, sourceDevice number, n integer);
		create table sessions (id text primary key, number text, json text);
		create table ints (x integer, y integer);
		create table nums (x number, y string);`,
	)
	.database()

// 1. comparisons (Signal v15, v20, v41, v89, v1760): STRING columns against text and numbers
const _cmp = await db.query(
	`select id from items where id = 'identityKey' or id = 'registrationId' or id = 1 or 'x' = id or id <> 2.5`,
)
expectType<typeof _cmp>(toBe<Array<{ id: number | string | null }>>())
const _gt = await db.query(`select id from messages where storyId > '0' and storyId < 10`)
expectType<typeof _gt>(toBe<Array<{ id: number | string | null }>>())
const _join = await db.query(
	`select messages.id from messages join emojis_old on messages.storyId = emojis_old.shortName where messages.type = 'x'`,
)
expectType<typeof _join>(toBe<Array<{ id: number | string | null }>>())
// IN list and IN subquery (v56, v58, v1410)
const _in = await db.query(`select id from items where id in ('defaultWallpaperPreset', 'b', 3)`)
expectType<typeof _in>(toBe<Array<{ id: number | string | null }>>())
const _inSub = await db.query(`select id from items where id in (select type from messages)`)
expectType<typeof _inSub>(toBe<Array<{ id: number | string | null }>>())
// LIKE, BETWEEN, simple CASE
const _like = await db.query(`select id from items where id like 'a%' and 'b' like id`)
expectType<typeof _like>(toBe<Array<{ id: number | string | null }>>())
const _between = await db.query(`select id from items where id between 'a' and 5`)
expectType<typeof _between>(toBe<Array<{ id: number | string | null }>>())
const _case = await db.query(`select case id when 'a' then 1 when 2 then 2 else 0 end as k from items`)
expectType<typeof _case>(toBe<Array<{ k: number }>>())

// 1. writes: a NUMERIC value into TEXT and INTEGER columns, text and numbers into NUMERIC columns
const writes = sqlMigrations({ driver: sqliteDriver }).apply(
	`create table sessions_old (id string primary key, number string, json text);
	create table sessions (id text primary key, number text, json text);
	insert into sessions (id, number, json) select '+' || id, number, json from sessions_old;
	create table a (x integer, y integer);
	create table b (x number, y string);
	insert into b select * from a;
	insert into a select * from b;
	insert into b (x, y) values ('text', 1), (2, 'two');
	insert into sessions (id, number) values ('a', (select x from b));
	update sessions set number = (select y from b);
	update a set x = (select x from b);
	create table c (x number default 'x', y string default 1);`,
)
const _writes = await writes.database().query(`select x, y from b`)
expectType<typeof _writes>(toBe<Array<{ x: number | string | null; y: number | string | null }>>())

// Still errors: no NUMERIC operand (TEXT against INTEGER is not this rule)
const intText = `select x from ints where x = 'a'` as const
expectType<GetQueryError<typeof db, typeof intText>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())
const intLike = `select x from ints where x like 'a%'` as const
expectType<GetQueryError<typeof db, typeof intLike>>(toBe<DbtyperError<2803, "LIKE left operand must be text">>())

// 2. a single-quoted column name (Signal v44): the name, folded like a quoted name, result key as declared
const quoted = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table badgeImageFiles (badgeId text, 'order' integer not null, 'Theme' text, url text not null);
		alter table badgeImageFiles add column 'localPath' text;`,
	)
	.database()
const _quoted = await quoted.query(`select "order", theme, localpath from badgeImageFiles`)
expectType<typeof _quoted>(toBe<Array<{ order: number; Theme: string | null; localPath: string | null }>>())
const dupQuoted = `create table d (a integer, 'A' text);` as const
expectType<GetApplyError<typeof empty, typeof dupQuoted>>(toBe<DbtyperError<3208, "Column a already exists">>())

// 3. a bare identifier as DEFAULT is that text (Signal v1180, v1200, v1390, v1420)
const bareDefault = sqlMigrations({ driver: sqliteDriver })
	.apply(
		`create table jobs (id integer primary key, kind text default plain);
		alter table jobs add column source text not null default standard;
		alter table jobs add column mode string not null default Fast;`,
	)
	.database()
const _bare = await bareDefault.query(`select kind, source, mode from jobs`)
expectType<typeof _bare>(toBe<Array<{ kind: string | null; source: string; mode: number | string }>>())
const bareIntoInteger = `create table e (n integer default standard);` as const
expectType<GetApplyError<typeof empty, typeof bareIntoInteger>>(
	toBe<DbtyperError<2507, "Incompatible value type for column n">>(),
)
const qualifiedDefault = `create table e (n text default a.b);` as const
expectType<GetApplyError<typeof empty, typeof qualifiedDefault>>(
	toBe<
		DbtyperError<
			1900,
			"DEFAULT expression without parentheses is PostgreSQL-only; this database is SQLite. Write DEFAULT (expression)"
		>
	>(),
)

// PostgreSQL unchanged: NUMERIC is a number, a string is no column name, a bare name is no DEFAULT
const pg = sqlMigrations({ driver: mockDriver }).apply(`create table p (n numeric, t text);`)
const pgCmp = `select n from p where n = 'a'` as const
expectType<GetQueryError<ReturnType<typeof pg.database>, typeof pgCmp>>(
	toBe<DbtyperError<2500, "Incompatible types in comparison">>(),
)
const pgInsert = `insert into p (n) values ('a');` as const
// @ts-expect-error
pg.apply(pgInsert)
const pgQuoted = `create table q ('order' integer);` as const
expectType<GetApplyError<typeof pg, typeof pgQuoted>>(
	toBe<DbtyperError<1206, "Expected column name in CREATE TABLE">>(),
)
const pgBare = `create table q (t text default standard);` as const
// @ts-expect-error
pg.apply(pgBare)
