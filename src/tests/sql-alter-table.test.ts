import type { SqlAlterTable, SqlParseError } from "../sql.js"
import { describe, it } from "node:test"
import type { Equal, Expect, Matches } from "./type-test-utils.js"

type AlterUsers = SqlAlterTable<`alter table users add column age int`>
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
			readonly source: string
		}
	>
>

type AlterPublicUsers = SqlAlterTable<`alter table public.users add column age int`>
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
			readonly source: string
		}
	>
>

type AlterUsersIfExists = SqlAlterTable<`alter table if exists public.users add column age int`>
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
			readonly source: string
		}
	>
>

type BadAlter = SqlAlterTable<`alter table public.users`>
type _BadAlter = Expect<Equal<BadAlter, SqlParseError<"Expected an ALTER TABLE action">>>

type AlterAddColumnIfNotExists =
	SqlAlterTable<`alter table users add column if not exists "display name" text not null`>
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
			readonly source: string
		}
	>
>

type AlterDropColumn = SqlAlterTable<`alter table users drop column if exists age`>
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
			readonly source: string
		}
	>
>

type AlterRenameTo = SqlAlterTable<`alter table users rename to app_users`>
type _AlterRenameTo = Expect<
	Matches<
		AlterRenameTo,
		{
			readonly kind: "alter_table"
			readonly action: {
				readonly kind: "rename_to"
				readonly name: "app_users"
			}
		}
	>
>

type AlterRenameColumn = SqlAlterTable<`alter table users rename column old_name to "new name"`>
type _AlterRenameColumn = Expect<
	Matches<
		AlterRenameColumn,
		{
			readonly kind: "alter_table"
			readonly action: {
				readonly kind: "rename_column"
				readonly from: "old_name"
				readonly to: "new name"
			}
		}
	>
>

type UnsupportedAlterAction = SqlAlterTable<`alter table users set schema archive`>
type _UnsupportedAlterAction = Expect<Equal<UnsupportedAlterAction, SqlParseError<"Unsupported ALTER TABLE action">>>

describe("sql alter table", () => {
	it("should run", () => {})
})
