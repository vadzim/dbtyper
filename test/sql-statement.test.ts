import { describe, it } from "node:test"
import type { sqlDatabase, sqlStatement } from "../src/engine/sql-database.ts"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

// --- sqlStatement: brands a string with its parsed type ---

type CreateUsersStatement = ReturnType<typeof sqlStatement<"create table users (id int not null, name text)">>

type _CreateUsersStatementParsedType = Expect<
	Matches<
		CreateUsersStatement["__sql_parsed__"],
		ParseSqlStatementsRecovering<ParseSqlTokens<"create table users (id int not null, name text)">>[1]
	>
>

type _CreateUsersStatementParsedShape = Expect<
	Matches<
		CreateUsersStatement["__sql_parsed__"],
		[
			{
				kind: "create_table"
				name: ["users"]
				row: { id: number; name: string | null }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

// --- sqlDatabase().apply(): only accepts branded strings, not plain strings ---

type Db = ReturnType<typeof sqlDatabase<"public">>

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
