/**
 * SqlApplyStatements: DROP TABLE apply type tests (qualified names, IF EXISTS, default schema).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { ParseSqlStatements } from "../parser/sql-parse-statement.js"
import type { ParseSqlTokens } from "../parser/sql-tokens.js"

type DbApplyDropTableFixture = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null)
`>
	>[0]
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
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table test.users
`>
	>[0]
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
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table if exists test.users
`>
	>[0]
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
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table test.missing
`>
	>[0]
>

type _DropMissingNoIfExists = Expect<
	Matches<DropMissingNoIfExists, SqlParserError<`Unknown dropped table "test.missing" in database`>>
>

/** IF EXISTS makes dropping a missing table a no-op. */

type DropMissingIfExists = SqlApplyStatements<
	SqlDatabase<"test">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table if exists test.missing
`>
	>[0]
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
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table users
`>
	>[0]
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
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema test;
	create schema auth;
	create table test.users (id int not null);
	create table test.posts (id int not null, user_id int not null);
	create table auth.sessions (id text not null);
	drop table auth.sessions
`>
	>[0]
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
