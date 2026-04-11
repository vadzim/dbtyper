import type { SqlStatements } from "../parser/sql-parse-statement.js"
import type { EmptyBuffer, InitBuffer } from "../parser/sql-tokens.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type AlterUsers = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type AlterPublicUsers = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type AlterUsersIfExists = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type BadAlter = SqlStatements<InitBuffer<`alter table public.users`>>
type _BadAlter = Expect<
	Matches<BadAlter, [SqlParseError<"Expected an ALTER TABLE action">, InitBuffer<`alter table public.users`>]>
>

type AlterAddColumnIfNotExists = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type AlterDropColumn = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type AlterRenameTo = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type AlterRenameColumn = SqlStatements<
	InitBuffer<`
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
			EmptyBuffer,
		]
	>
>

type UnsupportedAlterAction = SqlStatements<InitBuffer<`alter table users set schema archive`>>
type _UnsupportedAlterAction = Expect<
	Matches<
		UnsupportedAlterAction,
		[SqlParseError<"Unsupported ALTER TABLE action">, InitBuffer<`alter table users set schema archive`>]
	>
>

describe("sql alter table", () => {
	it("should run", () => {})
})
