import { describe, it } from "node:test"
import type { sqlDatabase, sqlStatement } from "../engine/sql-statement.js"
import type { Equal, Expect, ExpectFalse, Matches } from "./type-test-utils.js"

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

type _Y = Expect<Matches<Y, string & { readonly __sql_parsed__: unknown }>>
type _YParsed = Expect<
	Matches<
		Y["__sql_parsed__"],
		{
			readonly kind: "create_table"
			readonly name: readonly ["users"]
			readonly row: { id: number | null }
		}
	>
>

type XApplyArg = Parameters<X["apply"]>[0]
type _XApplyArgMustBeParsedStatement = ExpectFalse<Equal<XApplyArg, string>>
type _XApplyArgRejectsPlainString = ExpectFalse<"alter table users add column age int" extends XApplyArg ? true : false>
type _XApplyArgAcceptsParsedString = Expect<
	ReturnType<typeof sqlStatement<"alter table users add column age int">> extends XApplyArg ? true : false
>

type _XDefaultSchemaGetter = Expect<Equal<ReturnType<X["getDefaultSchema"]>, string>>
type _X4MigrationsGetter = Expect<Equal<ReturnType<X4["getMigrations"]>, string[]>>

type _X2 = Expect<Matches<X2, { apply(statement: string & { readonly __sql_parsed__: unknown }): unknown }>>
type _X3 = Expect<Matches<X3, { apply(statement: string & { readonly __sql_parsed__: unknown }): unknown }>>
type _X4 = Expect<Matches<X4, { getDefaultSchema(): string; getMigrations(): string[] }>>

describe("sql statement", () => {
	it("should run", () => {})
})
