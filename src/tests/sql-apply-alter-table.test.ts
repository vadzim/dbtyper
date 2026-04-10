/**
 * SqlApplyStatements: ALTER TABLE apply type tests (add/drop/rename column, rename table, IF EXISTS).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

type DbApplyAlterFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
	]
>

type _DbApplyAlterFixture = Expect<
	Matches<
		DbApplyAlterFixture,
		{
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
	>
>

// --- Add column ---

/** Add a new NOT NULL column on an existing table. */

type AddNewColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users add column email text not null`>,
	]
>

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

/** Duplicate column without IF NOT EXISTS is an error. */

type AddExistingColumnNoIfNotExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users add column age int`>,
	]
>

type _AddExistingColumnNoIfNotExists = Expect<
	Matches<AddExistingColumnNoIfNotExists, SqlParseError<"Duplicate column name: age">>
>

/** IF NOT EXISTS skips add when the column already exists. */

type AddExistingColumnIfNotExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users add column if not exists age int`>,
	]
>

type _AddExistingColumnIfNotExists = Expect<
	Matches<
		AddExistingColumnIfNotExists,
		{
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
	>
>

// --- Drop column ---

/** Drop an existing column. */

type DropExistingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users drop column age`>,
	]
>

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

/** Unknown column without IF EXISTS is an error. */

type DropMissingColumnNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users drop column missing`>,
	]
>

type _DropMissingColumnNoIfExists = Expect<
	Matches<DropMissingColumnNoIfExists, SqlParseError<`Unknown column "missing" in altered table`>>
>

/** IF EXISTS makes drop of a missing column a no-op. */

type DropMissingColumnIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users drop column if exists missing`>,
	]
>

type _DropMissingColumnIfExists = Expect<
	Matches<
		DropMissingColumnIfExists,
		{
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
	>
>

// --- Rename column ---

/** Rename an existing column. */

type RenameExistingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users rename column age to years`>,
	]
>

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

/** Rename from a missing column is an error. */

type RenameMissingColumn = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users rename column missing to years`>,
	]
>

type _RenameMissingColumn = Expect<
	Matches<RenameMissingColumn, SqlParseError<`Unknown column "missing" in altered table`>>
>

/** Target name that collides with an existing column is an error. */

type RenameToExistingColumnName = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users rename column age to id`>,
	]
>

type _RenameToExistingColumnName = Expect<
	Matches<RenameToExistingColumnName, SqlParseError<"Duplicate column name: id">>
>

// --- Rename table ---

/** Rename a table within its schema. */

type RenameTableOk = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users rename to members`>,
	]
>

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

/** New table name that already exists in the schema is an error. */

type RenameTableDuplicate = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.users rename to posts`>,
	]
>

type _RenameTableDuplicate = Expect<Matches<RenameTableDuplicate, SqlParseError<"Duplicate table name: posts">>>

// --- Table resolution ---

/** Alter a missing table without IF EXISTS is an error. */

type AlterMissingNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table test.missing add column age int`>,
	]
>

type _AlterMissingNoIfExists = Expect<
	Matches<AlterMissingNoIfExists, SqlParseError<`Unknown altered table "test.missing" in database`>>
>

type AlterMissingSchemeNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[SqlStatement<`alter table test.missing add column age int`>]
>

type _AlterMissingSchemeNoIfExists = Expect<
	Matches<AlterMissingSchemeNoIfExists, SqlParseError<`Unknown altered table "test.missing" in database`>>
>

type AlterMissingSchemeIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[SqlStatement<`alter table if exists test.missing add column age int`>]
>

type _AlterMissingSchemeIfExists = Expect<
	Matches<
		AlterMissingSchemeIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {}
		}
	>
>

/** IF EXISTS skips alter when the table is missing. */

type AlterMissingIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table if exists test.missing add column age int`>,
	]
>

type _AlterMissingIfExists = Expect<
	Matches<
		AlterMissingIfExists,
		{
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
	>
>

/** Unqualified name resolves to default schema; duplicate column is an error. */

type AlterDefaultSchemaUnqualified = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table users add column age int`>,
	]
>

type _AlterDefaultSchemaUnqualified = Expect<
	Matches<AlterDefaultSchemaUnqualified, SqlParseError<"Duplicate column name: age">>
>

/** Qualified alter on a non-default schema adds a nullable timestamptz column. */

type AlterExplicitSchemaQualified = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null, age int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`alter table auth.sessions add column expires_at timestamptz`>,
	]
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
