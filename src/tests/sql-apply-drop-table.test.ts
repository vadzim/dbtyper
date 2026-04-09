/**
 * SqlApplyStatements: DROP TABLE apply type tests (qualified names, IF EXISTS, default schema).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlStatement } from "../parser/sql-parse-statement.js"

type DbApplyDropTableFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
	]
>

type _DbApplyDropTableFixture = Expect<
	Matches<
		DbApplyDropTableFixture,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number }
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

// --- Drop table ---

/** Drop removes an existing table (qualified name). */

type DropExistingNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table test.users`>,
	]
>

type _DropExistingNoIfExists = Expect<
	Matches<
		DropExistingNoIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

/** IF EXISTS on an existing table still drops it. */

type DropExistingIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table if exists test.users`>,
	]
>

type _DropExistingIfExists = Expect<
	Matches<
		DropExistingIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

/** Unknown table without IF EXISTS is an error. */

type DropMissingNoIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table test.missing`>,
	]
>

type _DropMissingNoIfExists = Expect<
	Matches<DropMissingNoIfExists, SqlParseError<`Unknown dropped table "test.missing" in database`>>
>

/** IF EXISTS makes dropping a missing table a no-op. */

type DropMissingIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table if exists test.missing`>,
	]
>

type _DropMissingIfExists = Expect<
	Matches<
		DropMissingIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number }
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

/** Unqualified name resolves to the default schema. */

type DropDefaultSchemaUnqualified = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table users`>,
	]
>

type _DropDefaultSchemaUnqualified = Expect<
	Matches<
		DropDefaultSchemaUnqualified,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					posts: { id: number; user_id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

/** Qualified drop targets a non-default schema. */

type DropExplicitSchemaQualified = SqlApplyStatements<
	SqlDatabase<"test">,
	[
		SqlStatement<`create schema test`>,
		SqlStatement<`create schema auth`>,
		SqlStatement<`create table test.users (id int not null)`>,
		SqlStatement<`create table test.posts (id int not null, user_id int not null)`>,
		SqlStatement<`create table auth.sessions (id text not null)`>,
		SqlStatement<`drop table auth.sessions`>,
	]
>

type _DropExplicitSchemaQualified = Expect<
	Matches<
		DropExplicitSchemaQualified,
		{
			readonly kind: "database"
			readonly defaultSchema: "test"
			readonly schemas: {
				test: {
					users: { id: number }
					posts: { id: number; user_id: number }
				}
				auth: {}
			}
		}
	>
>

describe("sql apply drop table", () => {
	it("should run", () => {})
})
