// PGT-12, PGT-13, PGT-14, PGT-15, PGT-22: arrays per dimension, enums as label unions, domains, unmapped types.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import { mockDriver } from "../test-utils/test-databases.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"

const db = sqlMigrations({ driver: mockDriver })
	.apply(`create type mood as enum ('sad', 'ok');`)
	.apply(`create type other as enum ('x');`)
	.apply(`create domain pos as integer not null check (value > 0);`)
	.apply(`create domain label as text;`)
	.apply(
		`create table t (
			tags text[] not null, grid integer[][] not null, ids uuid[], moods mood[] not null,
			v mood not null, w mood, o other not null,
			p pos, l label, q pos[] not null,
			vec vector(3) not null
		);`,
	)
	.apply(`alter type mood add value 'happy';`)
	.database()

// PGT-12
const _a = await db.query(`select tags, grid, ids, moods from t`)
expectType<typeof _a>(
	toBe<
		{
			tags: readonly string[]
			grid: readonly (readonly number[])[]
			ids: readonly string[] | null
			moods: readonly ("sad" | "ok" | "happy")[]
		}[]
	>(),
)

// PGT-13: ALTER TYPE ADD VALUE changes the union
const _e = await db.query(`select v, w from t`)
expectType<typeof _e>(toBe<{ v: "sad" | "ok" | "happy"; w: "sad" | "ok" | "happy" | null }[]>())

// PGT-13: a cast to an enum
const _c = await db.query(`select 'ok'::mood as m from t`)
expectType<typeof _c>(toBe<{ m: "sad" | "ok" | "happy" }[]>())

// PGT-22: a domain is its base type, NOT NULL if the domain says so
const _d = await db.query(`select p, l, q from t`)
expectType<typeof _d>(toBe<{ p: number; l: string | null; q: readonly number[] }[]>())

// PGT-14: labels are valid
await db.query(`select v from t where v = 'ok' and v in ('sad', 'happy') and v between 'sad' and 'ok'`)
await db.query(`select case v when 'ok' then 1 else 2 end as x from t`)
await db.query(`insert into t (tags, grid, moods, v, o, p, q, vec) values ('{}', '{}', '{}', 'ok', 'x', 1, '{}', 'v')`)

// PGT-14: a parameter is typed as the label union
await db.query(`select v from t where v = $1`, ["ok" as const])

// PGT-14, EXPR-26: errors (an enum is a class of its own)
const unknownLabel = `select v from t where v = 'bad'` as const
// @ts-expect-error
await db.query(unknownLabel)
expectType<GetQueryError<typeof db, typeof unknownLabel>>(
	toBe<DbtyperError<2511, "'bad' is not a value of enum mood">>(),
)

const numberCmp = `select v from t where v = 1` as const
// @ts-expect-error
await db.query(numberCmp)
expectType<GetQueryError<typeof db, typeof numberCmp>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const twoEnums = `select v from t where v = o` as const
// @ts-expect-error
await db.query(twoEnums)
expectType<GetQueryError<typeof db, typeof twoEnums>>(toBe<DbtyperError<2500, "Incompatible types in comparison">>())

const badIn = `select v from t where v in ('ok', 'nope')` as const
// @ts-expect-error
await db.query(badIn)
expectType<GetQueryError<typeof db, typeof badIn>>(toBe<DbtyperError<2511, "'nope' is not a value of enum mood">>())

const badInsert =
	`insert into t (tags, grid, moods, v, o, p, q, vec) values ('{}', '{}', '{}', 'bad', 'x', 1, '{}', 'v')` as const
// @ts-expect-error
await db.query(badInsert)
expectType<GetQueryError<typeof db, typeof badInsert>>(toBe<DbtyperError<2511, "'bad' is not a value of enum mood">>())

// @ts-expect-error
await db.query(`select v from t where v = $1`, ["bad" as const])

// PGT-15: the column may be created; using it in a result is a compile error with the `::text` hint
await db.query(`select tags from t`)
const useVec = `select vec from t` as const
// @ts-expect-error
await db.query(useVec)
expectType<GetQueryError<typeof db, typeof useVec>>(
	toBe<
		DbtyperError<
			3506,
			"No TypeScript type for SQL type vector in the driver's type map; select it with a cast, e.g. `::text`"
		>
	>(),
)
