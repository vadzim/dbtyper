/**
 * SqlApplyStatements: CREATE SCHEMA apply type tests (duplicates, IF NOT EXISTS, chaining).
 */
import type { SqlDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"
import type { SqlApplyStatements } from "../engine/sql-apply-statement.js"
import type { SqlParseError } from "../parser/sql-tokens.js"
import type { SqlStatementLoose } from "../parser/sql-parse-statement.js"

// --- Create schema ---

/** New schema is merged into the database (fixture shape for following cases). */

type AfterCreateSchema = SqlApplyStatements<SqlDatabase<"public">, [SqlStatementLoose<`create schema auth`>]>

type _AfterCreateSchema = Expect<
	Matches<
		AfterCreateSchema,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly auth: {}
			}
		}
	>
>

/** Creating the same schema again without IF NOT EXISTS is an error. */

type DuplicateSchema = SqlApplyStatements<
	SqlDatabase<"public">,
	[SqlStatementLoose<`create schema auth`>, SqlStatementLoose<`create schema auth`>]
>

type _DuplicateSchema = Expect<Matches<DuplicateSchema, SqlParseError<"Duplicate schema name: auth">>>

/** IF NOT EXISTS leaves the database unchanged when the schema exists. */

type DuplicateIfNotExists = SqlApplyStatements<
	SqlDatabase<"public">,
	[SqlStatementLoose<`create schema auth`>, SqlStatementLoose<`create schema if not exists auth`>]
>

type _DuplicateIfNotExists = Expect<
	Matches<
		DuplicateIfNotExists,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly auth: {}
			}
		}
	>
>

// --- Chained DDL ---

/** After creating a schema, a table can be created inside it in a second statement. */

type DbAuthThenTable = SqlApplyStatements<
	SqlDatabase<"public">,
	[SqlStatementLoose<`create schema auth`>, SqlStatementLoose<`create table auth.users (id int not null)`>]
>

type _DbAuthThenTable = Expect<
	Matches<
		DbAuthThenTable,
		{
			readonly kind: "database"
			readonly defaultSchema: "public"
			readonly schemas: {
				readonly auth: {
					readonly users: { readonly id: number }
				}
			}
		}
	>
>

describe("sql apply create schema", () => {
	it("should run", () => {})
})
