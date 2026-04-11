import { describe, it } from "node:test"
import type { sqlDatabase, sqlStatement } from "../engine/sql-statement.js"
import type { SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { InitBuffer } from "../parser/sql-tokens.js"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

// --- sqlStatement: brands a string with its parsed type ---

type CreateUsersStatement = ReturnType<typeof sqlStatement<"create table users (id int not null, name text)">>

type _CreateUsersStatementParsedType = Expect<
	Matches<
		CreateUsersStatement["__sql_parsed__"],
		SqlStatementsRecovering<InitBuffer<"create table users (id int not null, name text)">>[0]
	>
>

type _CreateUsersStatementParsedShape = Expect<
	Matches<
		CreateUsersStatement["__sql_parsed__"],
		readonly [
			{
				readonly kind: "create_table"
				readonly name: readonly ["users"]
				readonly row: { id: number; name: string | null }
				readonly refs: undefined
			},
		]
	>
>

// --- sqlDatabase().apply(): only accepts branded strings, not plain strings ---

type Db = ReturnType<typeof sqlDatabase<"public">>
type ApplyArg = Parameters<Db["apply"]>[0]

type _ApplyRejectsPlainString = ExpectFalse<Matches<string, ApplyArg>>
type _ApplyRejectsUnbrandedLiteral = ExpectFalse<Matches<"alter table users add column age int", ApplyArg>>
type _ApplyAcceptsBrandedStatement = Expect<
	Db extends {
		apply(statement: ReturnType<typeof sqlStatement<"create schema app">>): unknown
	}
		? true
		: false
>

// --- sqlDatabase() methods ---

type _GetDefaultSchemaReturnsString = Expect<Matches<ReturnType<Db["getDefaultSchema"]>, string>>
type _GetMigrationsReturnsPromise = Expect<
	Matches<ReturnType<Db["getMigrations"]>, Promise<{ source: string; path: string }[]>>
>

// --- apply chain type-checks: each step narrows the database type ---

type DbWithSchema = ReturnType<
	Db["apply"] extends (statement: ReturnType<typeof sqlStatement<"create schema public">>) => infer Next
		? () => Next
		: never
>

type DbWithUsers = ReturnType<
	DbWithSchema["apply"] extends (
		statement: ReturnType<typeof sqlStatement<"create table users (id int not null)">>,
	) => infer Next
		? () => Next
		: never
>

type _GetMigrationsAfterApplyChain = Expect<
	Matches<ReturnType<DbWithUsers["getMigrations"]>, Promise<{ source: string; path: string }[]>>
>

describe("sql statement", () => {
	it("should run", () => {})
})
