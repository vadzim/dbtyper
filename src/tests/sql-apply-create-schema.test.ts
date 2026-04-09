import type { SqlCreateSchema } from "../parser/sql-create-schema.js"
import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlApplyCreateSchema } from "../engine/sql-apply-create-schema.js"
import type { SqlApplyStatement } from "../engine/sql-apply-statement.js"
import type { SqlEmptyDatabase } from "../engine/sql-database.js"
import { describe, it } from "node:test"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type EmptyDb = SqlEmptyDatabase<"public">

type AfterCreateSchema = SqlApplyCreateSchema<EmptyDb, SqlCreateSchema<`create schema auth`>>
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

type DbWithAuth = SqlApplyCreateSchema<EmptyDb, SqlCreateSchema<`create schema auth`>>

type DuplicateSchema = SqlApplyCreateSchema<DbWithAuth, SqlCreateSchema<`create schema auth`>>
type _DuplicateSchema = Expect<Matches<DuplicateSchema, SqlParseError<"Duplicate schema name: auth">>>

type DuplicateIfNotExists = SqlApplyCreateSchema<DbWithAuth, SqlCreateSchema<`create schema if not exists auth`>>
type _DuplicateIfNotExists = Expect<Matches<DuplicateIfNotExists, DbWithAuth>>

type DbAuthThenTable = SqlApplyStatement<
	SqlApplyStatement<EmptyDb, SqlCreateSchema<`create schema auth`>>,
	SqlCreateTable<`create table auth.users (id int not null)`>
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
