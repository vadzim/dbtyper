import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, TokenKey } from "../core/sql-tokens.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type AlterUsers = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users add column age int
`>
>
type _AlterUsers = Expect<
	Matches<
		AlterUsers,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "age"
						definition: number | null
					}
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users", "public"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "age"
						definition: number | null
					}
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: true
					target: ["users", "public"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "age"
						definition: number | null
					}
				},
			],
		]
	>
>

type BadAlter = ParseSqlStatements<ParseSqlTokens<`alter table public.users`>>
type _BadAlter = Expect<Matches<BadAlter[1], SqlParserError<"Expected an ALTER TABLE action">>>

type AlterAddColumnIfNotExists = ParseSqlStatements<
	ParseSqlTokens<`
	alter table users add column if not exists "display name" text not null
`>
>
type _AlterAddColumnIfNotExists = Expect<
	Matches<
		AlterAddColumnIfNotExists,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "add_column"
						ifNotExists: true
						name: "display name"
						definition: string
					}
				},
			],
		]
	>
>

type AlterAddColumnDefault = ParseSqlStatements<
	ParseSqlTokens<`alter table users add column created_at timestamptz default now() not null`>
>
type _AlterAddColumnDefault = Expect<
	Matches<
		AlterAddColumnDefault,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "created_at"
						definition: Date
						columnFacts: { created_at: { default: true } }
					}
				},
			],
		]
	>
>

type AlterAddColumnGenerated = ParseSqlStatements<
	ParseSqlTokens<`alter table users add column total int generated always as (1 + 2) stored`>
>
type _AlterAddColumnGenerated = Expect<
	Matches<
		AlterAddColumnGenerated,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "add_column"
						ifNotExists: false
						name: "total"
						definition: number | null
						columnFacts: { total: { generated: { mode: "stored" } } }
					}
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "drop_column"
						ifExists: true
						name: "age"
					}
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "rename_to"
						name: "app_users"
					}
				},
			],
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
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: {
						kind: "rename_column"
						from: "old_name"
						to: "new name"
					}
				},
			],
		]
	>
>

type UnsupportedAlterAction = ParseSqlStatements<ParseSqlTokens<`alter table users set schema archive;`>>
type _UnsupportedAlterAction = Expect<
	Matches<
		UnsupportedAlterAction,
		[
			EmptyTokenList,
			[
				{
					kind: "skipped-statement"
					token: TokenKey<";">
				},
			],
		]
	>
>

type AlterColumnSetNotNull = ParseSqlStatements<ParseSqlTokens<`alter table users alter column email set not null`>>
type _AlterColumnSetNotNull = Expect<
	Matches<
		AlterColumnSetNotNull,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["users"]
					action: { kind: "alter_column_set_not_null"; name: "email" }
				},
			],
		]
	>
>

type AlterColumnDropNotNull = ParseSqlStatements<
	ParseSqlTokens<`alter table public.posts alter column "body" drop not null`>
>
type _AlterColumnDropNotNull = Expect<
	Matches<
		AlterColumnDropNotNull,
		[
			EmptyTokenList,
			[
				{
					kind: "alter_table"
					ifExists: false
					target: ["posts", "public"]
					action: { kind: "alter_column_drop_not_null"; name: "body" }
				},
			],
		]
	>
>

describe("sql alter table", () => {
	it("should run", () => {})
})
