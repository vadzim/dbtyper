import { describe, it } from "node:test"
import type { SqlAlterTable } from "../parser/sql-alter-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlApplyAlterTable } from "../engine/sql-apply-alter-table.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Db0 = {
	readonly kind: "database"
	readonly defaultSchema: "test"
	readonly schemas: {
		test: {
			users: { id: number; age: number }
			posts: { id: number; user_id: number }
		}
		auth: {
			sessions: { id: string }
		}
	}
}

type AddNewColumn = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users add column email text not null`>>
type _AddNewColumn = Expect<
	Matches<
		AddNewColumn,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; age: number; email: string }
					posts: { id: number; user_id: number }
				}
				auth: { sessions: { id: string } }
			}
		}
	>
>

type AddExistingColumnNoIfNotExists = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table test.users add column age int`>
>
type _AddExistingColumnNoIfNotExists = Expect<
	Matches<AddExistingColumnNoIfNotExists, SqlParseError<"Duplicate column name: age">>
>

type AddExistingColumnIfNotExists = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table test.users add column if not exists age int`>
>
type _AddExistingColumnIfNotExists = Expect<Matches<AddExistingColumnIfNotExists, Db0>>

type DropExistingColumn = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users drop column age`>>
type _DropExistingColumn = Expect<
	Matches<
		DropExistingColumn,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number }
					posts: { id: number; user_id: number }
				}
				auth: { sessions: { id: string } }
			}
		}
	>
>

type DropMissingColumnNoIfExists = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users drop column missing`>>
type _DropMissingColumnNoIfExists = Expect<
	Matches<DropMissingColumnNoIfExists, SqlParseError<`Unknown column "missing" in altered table`>>
>

type DropMissingColumnIfExists = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table test.users drop column if exists missing`>
>
type _DropMissingColumnIfExists = Expect<Matches<DropMissingColumnIfExists, Db0>>

type RenameExistingColumn = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users rename column age to years`>>
type _RenameExistingColumn = Expect<
	Matches<
		RenameExistingColumn,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; years: number }
					posts: { id: number; user_id: number }
				}
				auth: { sessions: { id: string } }
			}
		}
	>
>

type RenameMissingColumn = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table test.users rename column missing to years`>
>
type _RenameMissingColumn = Expect<
	Matches<RenameMissingColumn, SqlParseError<`Unknown column "missing" in altered table`>>
>

type RenameToExistingColumnName = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table test.users rename column age to id`>
>
type _RenameToExistingColumnName = Expect<
	Matches<RenameToExistingColumnName, SqlParseError<"Duplicate column name: id">>
>

type RenameTableOk = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users rename to members`>>
type _RenameTableOk = Expect<
	Matches<
		RenameTableOk,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					members: { id: number; age: number }
					posts: { id: number; user_id: number }
				}
				auth: { sessions: { id: string } }
			}
		}
	>
>

type RenameTableDuplicate = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.users rename to posts`>>
type _RenameTableDuplicate = Expect<Matches<RenameTableDuplicate, SqlParseError<"Duplicate table name: posts">>>

type AlterMissingNoIfExists = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table test.missing add column age int`>>
type _AlterMissingNoIfExists = Expect<
	Matches<AlterMissingNoIfExists, SqlParseError<`Unknown altered table "test.missing" in database`>>
>

type AlterMissingIfExists = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table if exists test.missing add column age int`>
>
type _AlterMissingIfExists = Expect<Matches<AlterMissingIfExists, Db0>>

type AlterDefaultSchemaUnqualified = SqlApplyAlterTable<Db0, SqlAlterTable<`alter table users add column age int`>>
type _AlterDefaultSchemaUnqualified = Expect<
	Matches<AlterDefaultSchemaUnqualified, SqlParseError<"Duplicate column name: age">>
>

type AlterExplicitSchemaQualified = SqlApplyAlterTable<
	Db0,
	SqlAlterTable<`alter table auth.sessions add column expires_at timestamptz`>
>
type _AlterExplicitSchemaQualified = Expect<
	Matches<
		AlterExplicitSchemaQualified,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; age: number }
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string; expires_at: Date | null }
				}
			}
		}
	>
>

describe("sql apply alter table", () => {
	it("should run", () => {})
})
