import { describe, it } from "node:test"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlEmptyDatabase } from "../engine/sql-database.js"
import type { SqlApplyCreateTable } from "../engine/sql-apply-create-table.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type Db0 = {
	readonly kind: "database"
	readonly defaultSchema: "test"
	readonly schemas: {
		test: {
			users: { id: number; email: string }
		}
		auth: {}
	}
}

type CreateInDefaultSchema = SqlApplyCreateTable<
	Db0,
	SqlCreateTable<`create table posts (id int not null, user_id int not null)`>
>
type _CreateInDefaultSchema = Expect<
	Matches<
		CreateInDefaultSchema,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

type CreateInExplicitSchema = SqlApplyCreateTable<Db0, SqlCreateTable<`create table auth.sessions (id uuid not null)`>>
type _CreateInExplicitSchema = Expect<
	Matches<
		CreateInExplicitSchema,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; email: string }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

type CreateDuplicateTable = SqlApplyCreateTable<Db0, SqlCreateTable<`create table users (id int not null)`>>
type _CreateDuplicateTable = Expect<Matches<CreateDuplicateTable, SqlParseError<"Duplicate table name: users">>>

type CreateTableWithoutSchema = SqlApplyCreateTable<
	SqlEmptyDatabase<"public">,
	SqlCreateTable<`create table users (id int not null)`>
>
type _CreateTableWithoutSchema = Expect<
	Matches<CreateTableWithoutSchema, SqlParseError<`Unknown schema "public" (use CREATE SCHEMA first)`>>
>

type CreateInvalidRow = SqlApplyCreateTable<
	Db0,
	{
		readonly kind: "create_table"
		readonly name: readonly ["broken"]
		readonly row: SqlParseError<"bad row">
		readonly source: "create table broken (id)"
		readonly refs: never
	}
>
type _CreateInvalidRow = Expect<Matches<CreateInvalidRow, SqlParseError<"bad row">>>

type CreateWithForeignKeyOk = SqlApplyCreateTable<
	Db0,
	SqlCreateTable<`
		create table posts (
			id int not null,
			user_id int not null,
			foreign key (user_id) references users(id)
		)
	`>
>
type _CreateWithForeignKeyOk = Expect<
	Matches<
		CreateWithForeignKeyOk,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; email: string }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

type CreateWithForeignKeyBadLocal = SqlApplyCreateTable<
	Db0,
	{
		readonly kind: "create_table"
		readonly name: readonly ["posts_bad"]
		readonly row: SqlParseError<`Unknown column "missing_col" referenced in table constraint`>
		readonly source: "create table posts_bad (...)"
		readonly refs: never
	}
>
type _CreateWithForeignKeyBadLocal = Expect<
	Matches<CreateWithForeignKeyBadLocal, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

type CreateWithCompositeForeignKeyOk = SqlApplyCreateTable<
	Db0,
	SqlCreateTable<`
		create table pair_refs (
			id int not null,
			u_id int not null,
			u_email text not null,
			foreign key (u_id, u_email) references users(id, email)
		)
	`>
>
type _CreateWithCompositeForeignKeyOk = Expect<
	Matches<
		CreateWithCompositeForeignKeyOk,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; email: string }
					pair_refs: { id: number; u_id: number; u_email: string }
				}
				auth: {}
			}
		}
	>
>

type CreateWithCompositeForeignKeyBadArity = SqlApplyCreateTable<
	Db0,
	{
		readonly kind: "create_table"
		readonly name: readonly ["pair_arity_bad"]
		readonly row: SqlParseError<"Foreign key referenced column list has more entries than the local column list">
		readonly source: "create table pair_arity_bad (...)"
		readonly refs: never
	}
>
type _CreateWithCompositeForeignKeyBadArity = Expect<
	Matches<
		CreateWithCompositeForeignKeyBadArity,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql apply create table", () => {
	it("should run", () => {})
})
