/**
 * SqlApplyStatements: DROP SCHEMA apply type tests (cascade-free drop, missing schema, IF EXISTS).
 */
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"

type DbApplyDropSchemaFixture = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema public;
	create schema auth;
	create table public.users (id int not null);
	create table auth.sessions (id text not null)
`>
	>[1]
>

type _DbApplyDropSchemaFixture = Expect<
	Matches<
		DbApplyDropSchemaFixture,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				public: {
					tables: {
						users: { columns: { id: number } }
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
	>[1]
>

type _DropAuth = Expect<
	Matches<
		DropAuth,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				public: {
					tables: {
						users: { columns: { id: number } }
					}
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
	>[1]
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
	>[1]
>

type _DropMissingIfExists = Expect<
	Matches<
		DropMissingIfExists,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				public: {
					tables: {
						users: { columns: { id: number } }
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

describe("sql apply drop schema", () => {
	it("should run", () => {})
})
