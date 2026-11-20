// COLLATE as a postfix of an expression, array types in casts (#163, parser half), `::` after a function call.
import { sqlMigrations, type GetQueryError } from "../../src/core/sql-database.ts"
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import type { ParseExpressionAST } from "../../src/parser/parse-expression.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { mockDriver, sqliteDriver } from "../test-utils/test-databases.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"

const schema = `create table users (id integer not null, name text not null, email text);`
const lite = sqlMigrations({ driver: sqliteDriver }).apply(schema).database()
const pg = sqlMigrations({ driver: mockDriver }).apply(schema).database()

// COLLATE keeps the operand's type
const _where = await lite.query(`select id from users where name collate nocase = 'a'`)
expectType<typeof _where>(toBe<{ id: number }[]>())
const _orderPg = await pg.query(`select name from users order by name collate "C"`)
expectType<typeof _orderPg>(toBe<{ name: string }[]>())
const _orderLite = await lite.query(`select name from users order by name collate nocase desc`)
expectType<typeof _orderLite>(toBe<{ name: string }[]>())
const _sel = await lite.query(`select email collate binary as e, lower(name) collate nocase as l from users`)
expectType<typeof _sel>(toBe<{ e: string | null; l: string }[]>())
const _lit = await lite.query(`select 'a' collate nocase = name collate nocase as same from users`)
expectType<(typeof _lit)[number]["same"]>(toBe<number>())
type NoName = GetQueryError<typeof lite, `select name collate from users`>
expectType<NoName>(toBe<DbtyperError<5022, "Expected a collation name after COLLATE">>())

// `::` after a function call, a parenthesised expression and CASE
const _fn = await pg.query(
	`select lower(name)::text as n, (id + 1)::text as p, case when id > 1 then id else 2 end::text as c from users`,
)
expectType<typeof _fn>(toBe<{ n: string; p: string; c: string }[]>())

// array types: the parser appends one "[]" to type_parts for each pair (the result type is the resolver's)
type Env = { db: { defaultSchema: "public"; schemas: { public: { sets: {} } } }; params: {}; outerScope: {} }
type Ast<S extends string> =
	ParseExpressionAST<CreateParserMonad<S, "indexed-params">, Env> extends [infer _R, infer A, infer _E] ? A : never
expectType<Ast<`'{1,2}'::integer[]`>>(
	toBe<{ kind: "pg_cast"; expr: { kind: "string"; value: "{1,2}" }; type_parts: readonly ["integer", "[]"] }>(),
)
expectType<Ast<`$1::int[][]`>>(
	toBe<{ kind: "pg_cast"; expr: { kind: "positional-param"; index: 0 }; type_parts: readonly ["int", "[]", "[]"] }>(),
)
expectType<Ast<`cast(x as text[])`>["type_parts"]>(toBe<readonly ["text", "[]"]>())
// no longer 1007 / 4501; today the resolver answers 3506 (no TypeScript type for the array type)
type ArrCast = GetQueryError<typeof pg, `select '{1,2}'::integer[] as a`>
expectType<ArrCast extends DbtyperError<1007, string> | DbtyperError<4501, string> ? "parse error" : "parsed">(
	toBe<"parsed">(),
)
type ArrCastFn = GetQueryError<typeof pg, `select cast(name as text[]) as a from users`>
expectType<ArrCastFn extends DbtyperError<1007, string> | DbtyperError<4501, string> ? "parse error" : "parsed">(
	toBe<"parsed">(),
)
