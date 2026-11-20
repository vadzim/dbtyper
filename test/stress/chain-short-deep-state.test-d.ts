// #192: a short chain of ordinary SQLite migrations ended in raw TS2589 on a plain query: every ADD COLUMN, DROP
// COLUMN and mixed-case column made the schema type point at its earlier states, and reading it walked them all.
// The chain must typecheck and keep its types.
import { sqlMigrations } from "../../src/core/sql-database.ts"
import { sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const s0 = sqlMigrations({ driver: sqliteDriver })
const s1 = s0.apply("create table tasks (id integer primary key, title text not null);")
const s2 = s1.apply(
	"alter table tasks add column dueAt integer; alter table tasks add column doneFlag integer; create table task_notes (taskId integer, noteText text);",
)
const s3 = s2.apply(
	"alter table tasks add column ownerName text; alter table tasks add column sortRank integer; alter table tasks add column colorTag text;",
)
const s4 = s3.apply("alter table tasks drop column colorTag; alter table tasks add column remindAt integer;")
const s5 = s4.apply(
	"alter table tasks add column repeatRule text; alter table tasks add column parentId integer; alter table tasks add column archivedAt integer;",
)
const s6 = s5.apply("alter table tasks add column pinnedFlag integer; alter table tasks add column lastEditAt integer;")
const s7 = s6.apply(
	"insert into task_notes (taskId, noteText) select id, title from tasks where doneFlag is null or doneFlag != 1;",
)

const db = s7.database()
const _tasks = await db.query("select title, dueAt, repeatRule, lastEditAt from tasks where archivedAt is null")
expectType<typeof _tasks>(
	toBe<Array<{ title: string; dueAt: number | null; repeatRule: string | null; lastEditAt: number | null }>>(),
)
const _notes = await db.query("select taskId, noteText from task_notes")
expectType<typeof _notes>(toBe<Array<{ taskId: number | null; noteText: string | null }>>())
