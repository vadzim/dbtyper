/**
 * SqlApplyStatements: DROP TABLE apply type tests (qualified names, IF EXISTS, default schema).
 */
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"

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
	>[1]
>

type _DbApplyDropTableFixture = Expect<
	Matches<
		DbApplyDropTableFixture,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
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
	>[1]
>

type _DropExistingNoIfExists = Expect<
	Matches<
		DropExistingNoIfExists,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
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
	>[1]
>

type _DropExistingIfExists = Expect<
	Matches<
		DropExistingIfExists,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
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
	>[1]
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
	>[1]
>

type _DropMissingIfExists = Expect<
	Matches<
		DropMissingIfExists,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
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
	>[1]
>

type _DropDefaultSchemaUnqualified = Expect<
	Matches<
		DropDefaultSchemaUnqualified,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: {
					tables: {
						sessions: { columns: { id: string } }
					}
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
	>[1]
>

type _DropExplicitSchemaQualified = Expect<
	Matches<
		DropExplicitSchemaQualified,
		{
			kind: "database"
			defaultSchema: "test"
			schemas: {
				test: {
					tables: {
						users: { columns: { id: number } }
						posts: { columns: { id: number; user_id: number } }
					}
				}
				auth: { tables: {} }
			}
		}
	>
>

describe("sql apply drop table", () => {
	it("should run", () => {})
})
