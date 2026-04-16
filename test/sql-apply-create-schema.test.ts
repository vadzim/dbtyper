/**
 * SqlApplyStatements: CREATE SCHEMA apply type tests (duplicates, IF NOT EXISTS, chaining).
 */
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import { describe, it } from "node:test"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"

// --- Create schema ---

/** New schema is merged into the database (fixture shape for following cases). */

type AfterCreateSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema auth
`>
	>[1]
>

type _AfterCreateSchema = Expect<
	Matches<
		AfterCreateSchema,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				auth: {}
			}
		}
	>
>

/** Creating the same schema again without IF NOT EXISTS is an error. */

type DuplicateSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema auth;
	create schema auth
`>
	>[1]
>

type _DuplicateSchema = Expect<Matches<DuplicateSchema, SqlParserError<"Duplicate schema name: auth">>>

/** IF NOT EXISTS leaves the database unchanged when the schema exists. */

type DuplicateIfNotExists = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema auth;
	create schema if not exists auth
`>
	>[1]
>

type _DuplicateIfNotExists = Expect<
	Matches<
		DuplicateIfNotExists,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				auth: {}
			}
		}
	>
>

// --- Chained DDL ---

/** After creating a schema, a table can be created inside it in a second statement. */

type DbAuthThenTable = SqlApplyStatements<
	SqlDatabase<"public">,
	ParseSqlStatements<
		ParseSqlTokens<`
	create schema auth;
	create table auth.users (id int not null)
`>
	>[1]
>

type _DbAuthThenTable = Expect<
	Matches<
		DbAuthThenTable,
		{
			kind: "database"
			defaultSchema: "public"
			schemas: {
				auth: {
					users: { id: number }
				}
			}
		}
	>
>

describe("sql apply create schema", () => {
	it("should run", () => {})
})
