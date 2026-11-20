// Integration Test: PGT-14 and STMT-19 Checks (verification/postgres.md, statements.md @ 2a941c8), both lines whole.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const mood = sqlMigrations({ driver: mockDriver })
	.apply(`create type mood as enum ('happy', 'sad'); create table m (v mood not null);`)
	.database()
// ❌ ERROR: PGT-14 'happy' is a label of mood in this fixture; the Check names it as the unknown one, so use a schema without it
const noHappy = sqlMigrations({ driver: mockDriver })
	.apply(`create type mood as enum ('sad', 'ok'); create table m (v mood not null);`)
	.database()
const pgt14 = `select * from m where v = 'happy'` as const
// @ts-expect-error
await noHappy.query(pgt14)
expectType<GetQueryError<typeof noHappy, typeof pgt14>>(
	toBe<DbtyperError<2511, "'happy' is not a value of enum mood">>(),
)
const _ok = await mood.query(`select * from m where v = 'happy'`)
expectType<typeof _ok>(toBe<{ v: "happy" | "sad" }[]>())

const db = sqlMigrations({ driver: mockDriver }).apply(`create table users (id integer not null);`).database()
type Hint = "If this is SQL dbtyper does not know, run it with queryUntyped or streamUntyped"
const s1 = `selec id from users` as const
const s2 = `udpate users set id = 1` as const
const s3 = `foo bar;` as const
// @ts-expect-error
await db.query(s1)
// @ts-expect-error
await db.query(s2)
// @ts-expect-error
await db.query(s3)
expectType<GetQueryError<typeof db, typeof s1>>(
	toBe<DbtyperError<1931, `Unknown statement keyword selec; did you mean SELECT? ${Hint}`>>(),
)
expectType<GetQueryError<typeof db, typeof s2>>(
	toBe<DbtyperError<1931, `Unknown statement keyword udpate; did you mean UPDATE? ${Hint}`>>(),
)
expectType<GetQueryError<typeof db, typeof s3>>(toBe<DbtyperError<1930, `Unknown statement keyword foo. ${Hint}`>>())
