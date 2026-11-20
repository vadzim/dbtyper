// SEL-27 (PostgreSQL): a table whose whole PRIMARY KEY is grouped makes each of its columns grouped.
// CORE-15: the table keeps its PRIMARY KEY, so ALTER TABLE … ADD PRIMARY KEY on a table that has one is 1519.
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type Code<E> = E extends DbtyperError<infer C, string> ? C : E

const chain = sqlMigrations({ driver: mockDriver }).apply(
	`create table users (id integer primary key, name text not null, age integer not null);
	 create table posts (user_id integer not null, n integer not null, title text not null,
		 constraint posts_key primary key (user_id, n));
	 create table logs (id integer not null, msg text not null);`,
)
const db = chain.database()

// SEL-27: grouped by the primary key, bare, qualified or through an alias
const _byPk = await db.query(`select id, name, count(*) as c from users group by id`)
expectType<typeof _byPk>(toBe<Array<{ id: number; name: string; c: string }>>())
const _byAlias = await db.query(`select u.name, u.age from users u group by u.id`)
expectType<typeof _byAlias>(toBe<Array<{ name: string; age: number }>>())
const _byQualified = await db.query(`select users.name from users group by users.id`)
expectType<typeof _byQualified>(toBe<Array<{ name: string }>>())

// a composite key needs all its columns
const _byComposite = await db.query(`select title from posts group by user_id, n`)
expectType<typeof _byComposite>(toBe<Array<{ title: string }>>())
expectType<Code<GetQueryError<typeof db, `select title from posts group by user_id`>>>(toBe<3403>())

// only the grouped table's columns: another table of the join is still checked
const _join = await db.query(
	`select u.name, count(p.n) as c from users u join posts p on p.user_id = u.id group by u.id`,
)
expectType<typeof _join>(toBe<Array<{ name: string; c: string }>>())
expectType<
	Code<GetQueryError<typeof db, `select u.name, p.title from users u join posts p on p.user_id = u.id group by u.id`>>
>(toBe<3403>())

// a table without a primary key, or grouped by another column, is checked as before
expectType<Code<GetQueryError<typeof db, `select msg from logs group by id`>>>(toBe<3403>())
expectType<Code<GetQueryError<typeof db, `select id from users group by name`>>>(toBe<3403>())

// the key follows ALTER TABLE: added later, dropped by its name or with its column, renamed with its column
const added = chain.apply(`alter table logs add primary key (id);`).database()
const _added = await added.query(`select msg from logs group by id`)
expectType<typeof _added>(toBe<Array<{ msg: string }>>())
const named = chain.apply(`alter table logs add constraint logs_k primary key (id);`)
const _named = await named.database().query(`select msg from logs group by id`)
expectType<typeof _named>(toBe<Array<{ msg: string }>>())
const _droppedNamed = named.apply(`alter table logs drop constraint logs_k;`).database()
expectType<Code<GetQueryError<typeof _droppedNamed, `select msg from logs group by id`>>>(toBe<3403>())
const _droppedDefault = chain.apply(`alter table users drop constraint users_pkey;`).database()
expectType<Code<GetQueryError<typeof _droppedDefault, `select name from users group by id`>>>(toBe<3403>())
const _droppedTableName = chain.apply(`alter table posts drop constraint posts_key;`).database()
expectType<Code<GetQueryError<typeof _droppedTableName, `select title from posts group by user_id, n`>>>(toBe<3403>())
const renamed = chain.apply(`alter table users rename column id to uid;`).database()
const _renamed = await renamed.query(`select name from users group by uid`)
expectType<typeof _renamed>(toBe<Array<{ name: string }>>())
const droppedColumn = chain.apply(`alter table posts drop column n; alter table posts add primary key (user_id);`)
const _droppedColumn = await droppedColumn.database().query(`select title from posts group by user_id`)
expectType<typeof _droppedColumn>(toBe<Array<{ title: string }>>())
const addedColumn = chain.apply(`alter table logs add column k integer primary key;`).database()
const _addedColumn = await addedColumn.query(`select msg from logs group by k`)
expectType<typeof _addedColumn>(toBe<Array<{ msg: string }>>())

// CORE-15: a second primary key through ALTER TABLE is 1519
const secondPk = `alter table users add primary key (name);` as const
// @ts-expect-error 1519
chain.apply(secondPk)
expectType<GetApplyError<typeof chain, typeof secondPk>>(
	toBe<DbtyperError<1519, "Multiple primary keys for table users are not allowed">>(),
)
expectType<Code<GetApplyError<typeof chain, `alter table posts add constraint k2 primary key (title);`>>>(toBe<1519>())
expectType<Code<GetApplyError<typeof chain, `alter table users add column k integer primary key;`>>>(toBe<1519>())
// after dropping the old one a new primary key may be added
chain.apply(`alter table users drop constraint users_pkey; alter table users add primary key (name);`)

// SQLite has no GROUP BY rule; its tables are unaffected
const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (id integer primary key, name text not null);`)
	.database()
const _lite = await lite.query(`select name from t group by id`)
expectType<typeof _lite>(toBe<Array<{ name: string }>>())
