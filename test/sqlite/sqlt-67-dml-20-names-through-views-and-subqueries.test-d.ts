// SQLT-67: SQLite names match case-insensitively also through a view, a CTE or a subquery; the result key is the
// declared spelling (the drivers return it). DML-20: `*` from a CTE or subquery follows its output order.
// #179 items 5a, 5b (Signal v1450 read a mixed-case column through a view as 2307).
import { sqlMigrations, type GetApplyError, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

type IsError<E> = E extends DbtyperError<number, string> ? true : false

const chain = sqlMigrations({ driver: sqliteDriver }).apply(
	`create table messages (id integer primary key, conversationId text not null, sentAt integer not null);
	 create view recent as select id, conversationId, sentAt as SentTime from messages;`,
)
const db = chain.database()

// a view: unqualified, qualified, in another case; the key is the view's output name
const _view = await db.query(`select conversationid, CONVERSATIONID as c, senttime, r.SENTTIME as s from recent r`)
expectType<typeof _view>(toBe<Array<{ conversationId: string; c: string; SentTime: number; s: number }>>())
const _viewStar = await db.query(`select * from recent`)
expectType<typeof _viewStar>(toBe<Array<{ id: number; conversationId: string; SentTime: number }>>())
const _viewWhere = await db.query(`select id from recent r where r.conversationid = 'x' order by r.sentTime`)
expectType<typeof _viewWhere>(toBe<Array<{ id: number }>>())
// a view of a view
const v2 = chain.apply(`create view v2 as select CONVERSATIONID, SENTTIME from recent;`).database()
const _v2 = await v2.query(`select conversationid, senttime from v2`)
expectType<typeof _v2>(toBe<Array<{ conversationId: string; SentTime: number }>>())

// a CTE and a subquery; aliases and expression-text keys too
const _cte = await db.query(
	`with m as (select conversationId, count(*) as Total from messages group by conversationId) select CONVERSATIONID, total from m`,
)
expectType<typeof _cte>(toBe<Array<{ conversationId: string; Total: number }>>())
const _sub = await db.query(
	`select s.conversationid, s.MAXSENT from (select conversationId, max(sentAt) as MaxSent from messages group by conversationId) s`,
)
expectType<typeof _sub>(toBe<Array<{ conversationId: string; MaxSent: number | null }>>())
const _subUnqualified = await db.query(`select maxsent from (select max(sentAt) as MaxSent from messages) m`)
expectType<typeof _subUnqualified>(toBe<Array<{ MaxSent: number | null }>>())
const _cteColumns = await db.query(
	`with c(Cid, N) as (select conversationId, sentAt from messages) select cid, n from c`,
)
expectType<typeof _cteColumns>(toBe<Array<{ Cid: string; N: number }>>())
// a name that is not there is still an error
expectType<IsError<GetQueryError<typeof db, `select s.nope from (select conversationId from messages) s`>>>(
	toBe<true>(),
)

// DML-20: `*` and `alias.*` from a CTE or subquery give the columns in output order
type Keys<R> = R extends Array<infer Row> ? keyof Row : never
const _starCte = await db.query(`with m as (select sentAt, id, conversationId from messages) select * from m`)
expectType<typeof _starCte>(toBe<Array<{ sentAt: number; id: number; conversationId: string }>>())
expectType<Keys<typeof _starCte>>(toBe<"sentAt" | "id" | "conversationId">())
// the order shows where it matters: a set operation matches by position
const _union = await db.query(
	`select * from (select sentAt, id from messages) x union all select sentAt, id from messages`,
)
expectType<typeof _union>(toBe<Array<{ sentAt: number; id: number }>>())
const lite = sqlMigrations({ driver: sqliteDriver })
	.apply(`create table t (b text not null, a integer not null);`)
	.database()
// `select * from (select a, b …)` is (a, b): its arm against (integer, text) is fine, against (text, integer) not
const _ordered = await lite.query(`select * from (select a, b from t) x union select a, b from t`)
expectType<typeof _ordered>(toBe<Array<{ a: number; b: string }>>())
const _cteStar = await lite.query(`with s as (select a, b from t) select s.* from s union select a, b from t`)
expectType<typeof _cteStar>(toBe<Array<{ a: number; b: string }>>())

// PostgreSQL: names are folded by the lexer, keys as before; `*` from a subquery follows its order too
const pg = sqlMigrations({ driver: mockDriver })
	.apply(`create table t (b text not null, a integer not null); create view v as select a, b from t;`)
	.database()
const _pgSub = await pg.query(`select * from (select a, b from t) s union select a, b from t`)
expectType<typeof _pgSub>(toBe<Array<{ a: number; b: string }>>())
expectType<IsError<GetQueryError<typeof pg, `select * from (select a, b from t) s union select b, a from t`>>>(
	toBe<true>(),
)
expectType<IsError<GetApplyError<typeof chain, `create view bad as select nope from recent;`>>>(toBe<true>())
