/**
 * SqlApplyStatements: DROP SCHEMA apply type tests (cascade-free drop, missing schema, IF EXISTS).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { SqlParserError } from "../parser/sql-tokens.js"
import type { ParseSqlStatements } from "../parser/parse-sql-statement.js"
import type { ParseSqlTokens } from "../parser/sql-tokens.js"

type DbApplyDropSchemaFixture = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create schema auth;
	create table public.users (id int not null);
	create table auth.sessions (id text not null)
`>
	>[0]
>

type _DbApplyDropSchemaFixture = Expect<
	Matches<
		DbApplyDropSchemaFixture,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

// --- Drop schema ---

/** Drop removes a non-default schema and its tables from the database type. */

type DropAuth = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create schema auth;
	create table public.users (id int not null);
	create table auth.sessions (id text not null);
	drop schema auth
`>
	>[0]
>

type _DropAuth = Expect<
	Matches<
		DropAuth,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly public: {
					readonly users: { id: number }
				}
			}
		}
	>
>

/** Unknown schema without IF EXISTS is an error. */

type DropMissingNoIf = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create schema auth;
	create table public.users (id int not null);
	create table auth.sessions (id text not null);
	drop schema missing
`>
	>[0]
>

type _DropMissingNoIf = Expect<Matches<DropMissingNoIf, SqlParserError<`Unknown dropped schema "missing" in database`>>>

/** IF EXISTS makes dropping a missing schema a no-op. */

type DropMissingIfExists = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create schema auth;
	create table public.users (id int not null);
	create table auth.sessions (id text not null);
	drop schema if exists missing
`>
	>[0]
>

type _DropMissingIfExists = Expect<
	Matches<
		DropMissingIfExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				public: {
					users: { id: number }
				}
				auth: {
					sessions: { id: string }
				}
			}
		}
	>
>

describe("sql apply drop schema", () => {
	it("should run", () => {})
})
