import { describe, it } from "node:test"
import type { sqlDatabase, sqlStatement } from "../engine/sql-statement.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type ApplyResult<Db, S extends string> = Db extends {
	apply(statement: ReturnType<typeof sqlStatement<S>>): infer Next
}
	? Next
	: never

type Db0 = ReturnType<typeof sqlDatabase<"public">>
type Y = ReturnType<typeof sqlStatement<"create table users (id int primary key)">>
type X = ApplyResult<Db0, "create table users (id int primary key)">
type X2 = ApplyResult<X, "alter table users add column name text">
type X3 = ApplyResult<X2, "alter table users add column name2 text not null">
type X4 = ApplyResult<X3, "drop table users">

type _Y = Expect<
	Matches<
		Y["__sql_parsed__"],
		SqlStatement<"create table users (id int primary key)">
	>
>
type _YParsed = Expect<
	Matches<
		Omit<Y["__sql_parsed__"], "source">,
		{
			readonly kind: "create_table"
			readonly name: readonly ["users"]
			readonly row: { id: number | null }
			readonly __refs: undefined
		}
	>
>

type XApplyArg = Parameters<X["apply"]>[0]
type _XApplyArgMustBeParsedStatement = ExpectFalse<Matches<XApplyArg, string>>
type _XApplyArgRejectsPlainString = ExpectFalse<
	Matches<"alter table users add column age int", XApplyArg>
>
type _XApplyArgAcceptsParsedString = Expect<
	Matches<
		X extends { apply(statement: ReturnType<typeof sqlStatement<"alter table users add column age int">>): unknown }
			? true
			: false,
		true
	>
>

type _XDefaultSchemaGetter = Expect<Matches<ReturnType<X["getDefaultSchema"]>, string>>
type _X4MigrationsGetter = Expect<
	Matches<ReturnType<X4["getMigrations"]>, Promise<{ source: string; path: string }[]>>
>

type _X2 = Expect<Matches<ReturnType<X2["getMigrations"]>, Promise<{ source: string; path: string }[]>>>
type _X3 = Expect<Matches<ReturnType<X3["getMigrations"]>, Promise<{ source: string; path: string }[]>>>
type _X4 = Expect<Matches<ReturnType<X4["getMigrations"]>, Promise<{ source: string; path: string }[]>>>

describe("sql statement", () => {
	it("should run", () => {})
})
