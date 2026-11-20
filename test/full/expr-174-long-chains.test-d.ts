// #174: long operator chains and nested parentheses type-check (no TS2589); past the limits a dbtyper error names the limit.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table t (c1 integer not null, c2 integer, s text not null);`
const lite = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
const pg = sqlMigrations({ driver: mockDriver }).apply(schema).database()

// 100 operands: the same result type as a short chain (nullability: any nullable operand)
const _plus = await lite.query(
	`select c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 as x from t`,
)
expectType<typeof _plus>(toBe<{ x: number }[]>())
const _plusPg = await pg.query(
	`select c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 as x from t`,
)
expectType<typeof _plusPg>(toBe<{ x: number }[]>())
const _plusNull = await lite.query(
	`select c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c2 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 as x from t`,
)
expectType<typeof _plusNull>(toBe<{ x: number | null }[]>())
const _star = await lite.query(
	`select c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 as x from t`,
)
expectType<typeof _star>(toBe<{ x: number }[]>())
const _starPg = await pg.query(
	`select c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 * c1 as x from t`,
)
expectType<typeof _starPg>(toBe<{ x: number }[]>())
const _cat = await lite.query(
	`select s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s as x from t`,
)
expectType<typeof _cat>(toBe<{ x: string }[]>())
const _catPg = await pg.query(
	`select s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s || s as x from t`,
)
expectType<typeof _catPg>(toBe<{ x: string }[]>())
const _mixed = await lite.query(
	`select c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 + c1 * 2 - c1 as x from t`,
)
expectType<typeof _mixed>(toBe<{ x: number }[]>())

// an incompatible operand deep in a long chain is still reported
type BadChain = GetQueryError<
	typeof lite,
	`select c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + s + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 + c1 as x from t`
>
expectType<BadChain extends null ? "no error" : "error">(toBe<"error">())

// 20 nested parentheses (redundant ones are read in one step), in a WHERE and in a select list
const _paren = await lite.query(
	`select ((((((((((((((((((((c1 + 1)))))))))))))))))))) as x from t where ((((((((((((((((((((c1 > 0))))))))))))))))))))`,
)
expectType<typeof _paren>(toBe<{ x: number }[]>())
const _parenPg = await pg.query(`select ((((((((((((((((((((c1)))))))))))))))))))) as x from t`)
expectType<typeof _parenPg>(toBe<{ x: number }[]>())
const _parenMixed = await lite.query(`select (((c1 + 1) * 2) + 3) as x from t`)
expectType<typeof _parenMixed>(toBe<{ x: number }[]>())

// redundant parentheses are read in one pass; what follows an inner group is still parsed
const _parenFollow = await lite.query(
	`select (((c1) + 1) * 2) as a, ((c1) > 0 and (c2 is null)) as b, ((select 1) + c1) as c, (((c1))) + 1 as d from t where ((c1) = 1 or (c1) = 2)`,
)
expectType<typeof _parenFollow>(toBe<{ a: number; b: number; c: number | null; d: number }[]>())
const _parenCast = await pg.query(`select (((c1)::text)) as a, ((s collate "C")) as b from t`)
expectType<typeof _parenCast>(toBe<{ a: string; b: string }[]>())
type MissingClose = GetQueryError<typeof lite, `select ((c1) + 1 as x from t`>
expectType<MissingClose>(toBe<DbtyperError<5006, "Expected `)`">>())

// limits that remain: a dbtyper error, not TS2589
type DeepParens = GetQueryError<
	typeof lite,
	`select (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + (c1 + 1)))))))))))) as x from t`
>
expectType<DeepParens>(
	toBe<
		DbtyperError<
			5020,
			"Parentheses, function calls and CASE are nested more than 8 levels deep; simplify the expression or split the query"
		>
	>(),
)
type LongMinus = GetQueryError<
	typeof lite,
	`select c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 as x from t`
>
expectType<LongMinus>(
	toBe<DbtyperError<5021, "More than 20 chained `-` operators; split the expression into parenthesized groups">>(),
)
const _minus = await lite.query(
	`select c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 - c1 as x from t`,
)
expectType<typeof _minus>(toBe<{ x: number }[]>())
