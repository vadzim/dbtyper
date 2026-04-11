/**
 * SqlApplyStatements: CREATE TABLE apply type tests (schemas, FKs, duplicates, parse errors).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlStatements, SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { InitBuffer, SqlParseError } from "../parser/sql-tokens.js"

type DbApplyCreateTableFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
	>[0]
>

type _DbApplyCreateTableFixture = Expect<
	Matches<
		DbApplyCreateTableFixture,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number; email: string }
				}
				auth: {}
			}
		}
	>
>

// type MixedCaseColumns = SqlApplyStatements<
// 	SqlDatabase<"test">,
// 	[
// 		SqlStatements<InitBuffer<`create schema test`>>[0],
// 		SqlStatements<InitBuffer<`create table users ("Id" int not null, "Main   Title" text not null)`>>[0],
// 	]
// >

// type _MixedCaseColumns = Expect<
// 	Matches<
// 		DbApplyCreateTableFixture,
// 		{
// 			readonly kind: "database"
// 			readonly defaultSchema: "test"
// 			readonly schemas: {
// 				test: {
// 					users: { Id: number; "Main   Title": string }
// 				}
// 			}
// 		}
// 	>
// >

// --- Create table (default and explicit schema) ---

/** New table in the default schema. */

type CreateInDefaultSchema = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table posts (id int not null, user_id int not null)
`>
	>[0]
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

/** New table in a qualified non-default schema. */

type CreateInExplicitSchema = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table auth.sessions (id uuid not null)
`>
	>[0]
>

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

// --- Duplicates and missing schema ---

/** Duplicate table name in the same schema is an error. */

type CreateDuplicateTable = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table users (id int not null)
`>
	>[0]
>

type _CreateDuplicateTable = Expect<Matches<CreateDuplicateTable, SqlParseError<"Duplicate table name: users">>>

/** Creating a table when the default schema does not exist yet is an error. */

type CreateTableWithoutSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	SqlStatements<InitBuffer<`create table users (id int not null)`>>[0]
>

type _CreateTableWithoutSchema = Expect<
	Matches<CreateTableWithoutSchema, SqlParseError<`Unknown schema "public" (use CREATE SCHEMA first)`>>
>

// --- Parse and FK validation errors ---

type CreateInvalidRowStatement = {
	readonly kind: "create_table"
	readonly name: readonly ["broken"]
	readonly row: SqlParseError<"bad row">
	readonly source: "create table broken (id)"
	readonly refs: never
}

/** Row parse error on create_table is propagated. */

type CreateInvalidRow = SqlApplyStatements<
	SqlDatabase<"test">,
	readonly [
		...SqlStatements<
			InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
		>[0],
		CreateInvalidRowStatement,
	]
>

type _CreateInvalidRow = Expect<Matches<CreateInvalidRow, SqlParseError<"bad row">>>

/** Valid foreign key referencing default-schema users. */

type CreateWithForeignKeyOk = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table posts (
		id int not null,
		user_id int not null,
		foreign key (user_id) references users(id)
	)
`>
	>[0]
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

type CreateWithForeignKeyBadLocalStatement = {
	readonly kind: "create_table"
	readonly name: readonly ["posts_bad"]
	readonly row: SqlParseError<`Unknown column "missing_col" referenced in table constraint`>
	readonly source: "create table posts_bad (...)"
	readonly refs: never
}

/** FK referencing a non-existent local column is an error. */

type CreateWithForeignKeyBadLocal = SqlApplyStatements<
	SqlDatabase<"test">,
	readonly [
		...SqlStatements<
			InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null)
`>
		>[0],
		CreateWithForeignKeyBadLocalStatement,
	]
>

type _CreateWithForeignKeyBadLocal = Expect<
	Matches<CreateWithForeignKeyBadLocal, SqlParseError<`Unknown column "missing_col" referenced in table constraint`>>
>

/** Composite foreign key with matching arity. */

type CreateWithCompositeForeignKeyOk = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatements<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table pair_refs (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id, u_email) references users(id, email)
	)
`>
	>[0]
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

type CreateWithCompositeForeignKeyBadArity = SqlApplyStatements<
	SqlDatabase<"test">,
	SqlStatementsRecovering<
		InitBuffer<`
	create schema test;
	create schema auth;
	create table test.users (id int not null, email text not null);
	create table pair_arity_bad (
		id int not null,
		u_id int not null,
		u_email text not null,
		foreign key (u_id) references users(id, email)
	)
`>
	>[0]
>

/** Mismatched local vs referenced column counts is an error. */

type _CreateWithCompositeForeignKeyBadArity = Expect<
	Matches<
		CreateWithCompositeForeignKeyBadArity,
		SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	>
>

describe("sql apply create table", () => {
	it("should run", () => {})
})
