import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type AlterUsers = SqlStatement<`alter table users add column age int`>
type _AlterUsers = Expect<
	Matches<
		AlterUsers,
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
		}
	>
>

type AlterPublicUsers = SqlStatement<`alter table public.users add column age int`>
type _AlterPublicUsers = Expect<
	Matches<
		AlterPublicUsers,
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
		}
	>
>

type AlterUsersIfExists = SqlStatement<`alter table if exists public.users add column age int`>
type _AlterUsersIfExists = Expect<
	Matches<
		AlterUsersIfExists,
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
		}
	>
>

type BadAlter = SqlStatement<`alter table public.users`>
type _BadAlter = Expect<Matches<BadAlter, SqlParseError<"Expected an ALTER TABLE action">>>

type AlterAddColumnIfNotExists = SqlStatement<`alter table users add column if not exists "display name" text not null`>
type _AlterAddColumnIfNotExists = Expect<
	Matches<
		AlterAddColumnIfNotExists,
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
		}
	>
>

type AlterDropColumn = SqlStatement<`alter table users drop column if exists age`>
type _AlterDropColumn = Expect<
	Matches<
		AlterDropColumn,
		{
			readonly kind: "alter_table"
			readonly ifExists: false
			readonly target: readonly ["users"]
			readonly action: {
				readonly kind: "drop_column"
				readonly ifExists: true
				readonly name: "age"
			}
		}
	>
>

type AlterRenameTo = SqlStatement<`alter table users rename to app_users`>
type _AlterRenameTo = Expect<
	Matches<
		AlterRenameTo,
		{
			readonly kind: "alter_table"
			readonly ifExists: false
			readonly target: readonly ["users"]
			readonly action: {
				readonly kind: "rename_to"
				readonly name: "app_users"
			}
		}
	>
>

type AlterRenameColumn = SqlStatement<`alter table users rename column old_name to "new name"`>
type _AlterRenameColumn = Expect<
	Matches<
		AlterRenameColumn,
		{
			readonly kind: "alter_table"
			readonly ifExists: false
			readonly target: readonly ["users"]
			readonly action: {
				readonly kind: "rename_column"
				readonly from: "old_name"
				readonly to: "new name"
			}
		}
	>
>

type UnsupportedAlterAction = SqlStatement<`alter table users set schema archive`>
type _UnsupportedAlterAction = Expect<Matches<UnsupportedAlterAction, SqlParseError<"Unsupported ALTER TABLE action">>>

describe("sql alter table", () => {
	it("should run", () => {})
})
