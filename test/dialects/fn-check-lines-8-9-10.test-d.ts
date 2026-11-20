// Integration Test: FN-8, FN-9, FN-10 Checks (verification/functions.md @ 2a941c8)
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(
		`create type priority as enum ('low', 'high');
		 create table users (id integer not null, name text not null, email text);
		 create table tasks (task_priority priority);
		 create table t (id integer not null, name text not null);
		 create table u (id integer not null);`,
	)
	.database()

// FN-8
const q8 = `select coalesce() from t` as const
// @ts-expect-error
await db.query(q8)
expectType<GetQueryError<typeof db, typeof q8>>(toBe<DbtyperError<3607, "coalesce() requires at least one argument">>())
const _fn8 = await db.query(`select coalesce(task_priority, 'low'::priority) as p from tasks`)
expectType<typeof _fn8>(toBe<{ p: "low" | "high" }[]>())
const _fn8b = await db.query(`select coalesce(null, email) as a, coalesce(email, 'x') as b from users`)
expectType<typeof _fn8b>(toBe<{ a: string | null; b: string }[]>())

// FN-9
const _fn9 = await db.query(`select lower(name) as l, upper(name) as u from users`)
expectType<typeof _fn9>(toBe<{ l: string; u: string }[]>())
const q9 = `select lower() from t` as const
// @ts-expect-error
await db.query(q9)
expectType<GetQueryError<typeof db, typeof q9>>(toBe<DbtyperError<3601, "Function requires at least one argument">>())

// FN-10
const q10a = `select now(1) from u` as const
// @ts-expect-error
await db.query(q10a)
expectType<GetQueryError<typeof db, typeof q10a>>(toBe<DbtyperError<3604, "now() takes no arguments">>())
const q10b = `select uuid_generate_v4(1) from t` as const
// @ts-expect-error
await db.query(q10b)
expectType<GetQueryError<typeof db, typeof q10b>>(toBe<DbtyperError<3600, "This function takes no arguments">>())
const _fn10 = await db.query(`select now() as n, gen_random_uuid() as g, uuid_generate_v4() as u`)
expectType<typeof _fn10>(toBe<{ n: Date; g: string; u: string }[]>())
