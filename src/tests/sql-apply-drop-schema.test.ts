/**
 * SqlApplyStatements: DROP SCHEMA apply type tests (cascade-free drop, missing schema, IF EXISTS).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"

type DbApplyDropSchemaFixture = SqlApplyStatements<
	SqlDatabase<"public">,
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create schema auth`>,
		SqlStatementLoose<`create table public.users (id int not null)`>,
		SqlStatementLoose<`create table auth.sessions (id text not null)`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create schema auth`>,
		SqlStatementLoose<`create table public.users (id int not null)`>,
		SqlStatementLoose<`create table auth.sessions (id text not null)`>,
		SqlStatementLoose<`drop schema auth`>,
	]
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
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create schema auth`>,
		SqlStatementLoose<`create table public.users (id int not null)`>,
		SqlStatementLoose<`create table auth.sessions (id text not null)`>,
		SqlStatementLoose<`drop schema missing`>,
	]
>

type _DropMissingNoIf = Expect<Matches<DropMissingNoIf, SqlParseError<`Unknown dropped schema "missing" in database`>>>

/** IF EXISTS makes dropping a missing schema a no-op. */

type DropMissingIfExists = SqlApplyStatements<
	SqlDatabase<"public">,
	[
		SqlStatementLoose<`create schema public`>,
		SqlStatementLoose<`create schema auth`>,
		SqlStatementLoose<`create table public.users (id int not null)`>,
		SqlStatementLoose<`create table auth.sessions (id text not null)`>,
		SqlStatementLoose<`drop schema if exists missing`>,
	]
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
