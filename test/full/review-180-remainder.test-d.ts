// #180 (review #175 batch 2 remainder): nesting limit for parentheses, calls and CASE; the cast type name read by the
// shared type-name parser; SQLite `-?`; a BOOLEAN column as a SQLite condition.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table t (c1 integer not null, c2 integer, s text not null, flag boolean not null);`
const lite = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
const pg = sqlMigrations({ driver: mockDriver }).apply(schema).database()

type TooDeep = DbtyperError<
	5020,
	"Parentheses, function calls and CASE are nested more than 8 levels deep; simplify the expression or split the query"
>

// 8 levels (the limit, spec: at least 8) of each kind type-check, in a select list and in a scalar subquery
const _paren8 = await lite.query(`select c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1)))))))) as x from t`)
expectType<typeof _paren8>(toBe<{ x: number }[]>())
const _paren8Sub = await pg.query(
	`select (select c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1)))))))) as y from t) as x from t`,
)
expectType<typeof _paren8Sub>(toBe<{ x: number | null }[]>())
const _call8 = await lite.query(`select abs(abs(abs(abs(abs(abs(abs(abs(c1)))))))) as x from t`)
expectType<typeof _call8>(toBe<{ x: number }[]>())
const _coalesce8 = await pg.query(
	`select (select coalesce(coalesce(coalesce(coalesce(coalesce(coalesce(coalesce(coalesce(c2, 0), 0), 0), 0), 0), 0), 0), 0) as y from t) as x from t`,
)
expectType<typeof _coalesce8>(toBe<{ x: number | null }[]>())
const _case8 = await lite.query(
	`select case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then c1 else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end as x from t`,
)
expectType<typeof _case8>(toBe<{ x: number }[]>())
const _caseWhen8 = await pg.query(
	`select (select case when case when case when case when case when case when case when case when c1 > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end > 0 then 1 else 0 end as y from t) as x from t`,
)
expectType<typeof _caseWhen8>(toBe<{ x: number | null }[]>())
const _mixed8 = await lite.query(
	`select abs(c1 + (case when c1 > 0 then abs(c1 + (case when c1 > 0 then abs(c1 + (c1)) else 0 end)) else 0 end)) as x from t where c1 = abs(c1 + (case when c1 > 0 then abs(c1 + (case when c1 > 0 then abs(c1 + (c1)) else 0 end)) else 0 end))`,
)
expectType<typeof _mixed8>(toBe<{ x: number }[]>())
// siblings do not add up: only nesting counts
const _siblings = await lite.query(
	`select abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) + abs(c1) as x,
		case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end + case when c1 > 0 then 1 end as y from t`,
)
expectType<typeof _siblings>(toBe<{ x: number; y: number | null }[]>())

// one level more: the dbtyper error, never TS2589 (#174 leftovers: calls and CASE did not count)
type Paren9 = GetQueryError<
	typeof lite,
	`select c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1))))))))) as x from t`
>
expectType<Paren9>(toBe<TooDeep>())
type Call9 = GetQueryError<typeof pg, `select abs(abs(abs(abs(abs(abs(abs(abs(abs(c1))))))))) as x from t`>
expectType<Call9>(toBe<TooDeep>())
type Call15 = GetQueryError<
	typeof lite,
	`select abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(c1))))))))))))))) as x from t`
>
expectType<Call15>(toBe<TooDeep>())
type Case9 = GetQueryError<
	typeof lite,
	`select case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then case when c1 > 0 then c1 else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end as x from t`
>
expectType<Case9>(toBe<TooDeep>())
type Case12Simple = GetQueryError<
	typeof pg,
	`select case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then case c1 when 1 then c1 else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end else 0 end as x from t`
>
expectType<Case12Simple>(toBe<TooDeep>())
type Mixed9 = GetQueryError<
	typeof pg,
	`select (select abs(c1 + (case when c1 > 0 then abs(c1 + (case when c1 > 0 then abs(c1 + (abs(c1))) else 0 end)) else 0 end)) as y from t) as x from t`
>
expectType<Mixed9>(toBe<TooDeep>())

// The cast type name is read by the type-name parser of column types (parse-sql-type-words.ts): the same words,
// modifiers, zone words and `[]`
const _casts = await pg.query(
	`select cast(c1 as double precision) as a, s::character varying(10) as b, cast(s as varchar(10)[]) as c,
		s::timestamp(3) with time zone as d, c1::numeric(10, 2) as e, s::text collate "C" as f, c1::int g from t`,
)
expectType<typeof _casts>(
	toBe<{ a: number; b: string; c: readonly string[]; d: Date; e: string; f: string; g: number }[]>(),
)
// a word that does not continue a type name ends it (#159 for casts): CAST wants `)` there
type CastBadWord = GetQueryError<typeof pg, `select cast(c1 as int nut) as x from t`>
expectType<CastBadWord>(toBe<DbtyperError<4501, "Expected `)` after CAST type">>())
type CastNoType = GetQueryError<typeof pg, `select cast(c1 as) as x from t`>
expectType<CastNoType>(toBe<DbtyperError<4105, "Expected type name after CAST ... AS">>())
// SQLite takes any words as the type name (SQLT-6) and types the cast by the name's affinity (SQLT-12)
const _liteCasts = await lite.query(
	`select cast(s as unsigned big int) as a, cast(c1 as varchar(10)) as b, cast(c1 as double precision) as c from t`,
)
expectType<typeof _liteCasts>(toBe<{ a: number; b: string; c: number }[]>())

// SQLite: `?` after an operator without a space is the parameter, not part of the operator
const _minusParam = await lite.query(`select c1 as x from t where c1 = -? and c1 >=? and c1<>-?`, [1, 2, 3])
expectType<typeof _minusParam>(toBe<{ x: number }[]>())

// SQLite: a declared BOOLEAN column (an integer, SQLT-9) is a condition
const _flag = await lite.query(
	`select c1 as x from t where flag and not flag or (flag) and case when flag then 1 else 0 end = 1`,
)
expectType<typeof _flag>(toBe<{ x: number }[]>())
const _flagPg = await pg.query(`select c1 as x from t where flag and not flag`)
expectType<typeof _flagPg>(toBe<{ x: number }[]>())

// a function call as the right operand of an operator (was 1007 "Unexpected token at: (")
const _rightCalls = await pg.query(
	`select c1 + abs(c2) as a, 2 * coalesce(c2, 0) as b, s || lower(s) as c, c1 - length(s) as d, abs(c1) * abs(c1) + 1 as e from t`,
)
expectType<typeof _rightCalls>(toBe<{ a: number | null; b: number; c: string; d: number; e: number }[]>())
const _rightCallsLite = await lite.query(
	`select c1 + abs(c2) as a, 2 * coalesce(c2, 0) as b, c1 - length(s) as d from t where c1 + abs(c1) > 0`,
)
expectType<typeof _rightCallsLite>(toBe<{ a: number | null; b: number; d: number }[]>())
