import type { ParseSqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens } from "../parser/sql-tokens.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type AlterUsers = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users add column age int
`>
>
type _AlterUsers = Expect<
	Matches<
		AlterUsers,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users"]
					readonly action: {
						readonly kind: "add_column"
						readonly ifNotExists: false
						readonly name: "age"
						readonly definition: number | null
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type AlterPublicUsers = ParseSqlStatements<
	ParseSqlTokens<`
	alter table public.users add column age int
`>
>
type _AlterPublicUsers = Expect<
	Matches<
		AlterPublicUsers,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users", "public"]
					readonly action: {
						readonly kind: "add_column"
						readonly ifNotExists: false
						readonly name: "age"
						readonly definition: number | null
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type AlterUsersIfExists = ParseSqlStatements<
	ParseSqlTokens<`
	alter table if exists public.users add column age int
`>
>
type _AlterUsersIfExists = Expect<
	Matches<
		AlterUsersIfExists,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: true
					readonly target: readonly ["users", "public"]
					readonly action: {
						readonly kind: "add_column"
						readonly ifNotExists: false
						readonly name: "age"
						readonly definition: number | null
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type BadAlter = ParseSqlStatements<ParseSqlTokens<`alter table public.users`>>
type _BadAlter = Expect<
	Matches<BadAlter, [SqlParserError<"Expected an ALTER TABLE action">, ParseSqlTokens<`alter table public.users`>]>
>

type AlterAddColumnIfNotExists = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users add column if not exists "display name" text not null
`>
>
type _AlterAddColumnIfNotExists = Expect<
	Matches<
		AlterAddColumnIfNotExists,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users"]
					readonly action: {
						readonly kind: "add_column"
						readonly ifNotExists: true
						readonly name: "display name"
						readonly definition: string
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type AlterDropColumn = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users drop column if exists age
`>
>
type _AlterDropColumn = Expect<
	Matches<
		AlterDropColumn,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users"]
					readonly action: {
						readonly kind: "drop_column"
						readonly ifExists: true
						readonly name: "age"
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type AlterRenameTo = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users rename to app_users
`>
>
type _AlterRenameTo = Expect<
	Matches<
		AlterRenameTo,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users"]
					readonly action: {
						readonly kind: "rename_to"
						readonly name: "app_users"
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type AlterRenameColumn = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users rename column old_name to "new name"
`>
>
type _AlterRenameColumn = Expect<
	Matches<
		AlterRenameColumn,
		[
			readonly [
				{
					readonly kind: "alter_table"
					readonly ifExists: false
					readonly target: readonly ["users"]
					readonly action: {
						readonly kind: "rename_column"
						readonly from: "old_name"
						readonly to: "new name"
					}
				},
			],
			EmptyTokenList,
		]
	>
>

type UnsupportedAlterAction = ParseSqlStatements<ParseSqlTokens<`alter table users set schema archive;`>>
type _UnsupportedAlterAction = Expect<
	Matches<UnsupportedAlterAction, [readonly [{ readonly kind: "ignorable" }], EmptyTokenList]>
>

describe("sql alter table", () => {
	it("should run", () => {})
})
