import { describe, it } from "node:test"
import type { SqlApply } from "../engine/sql-apply.js"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

type ApplyCreateSchemaWithRest = SqlApply<
	SqlDatabase<"public">,
	`create schema if not exists app; create table app.users (id int not null)`
>
type _ApplyCreateSchemaWithRest = Expect<
	Matches<
		ApplyCreateSchemaWithRest,
		[
			{
				readonly kind: "database"
				readonly defaultSchema: "public"
				readonly schemas: {
					app: {}
				}
			},
			"create table app.users (id int not null)",
		]
	>
>

type ApplyOneStatement = SqlApply<SqlDatabase<"public">, `create schema app`>
type _ApplyOneStatement = Expect<
	Matches<
		ApplyOneStatement,
		[
			{
				readonly kind: "database"
				readonly defaultSchema: "public"
				readonly schemas: {
					app: {}
				}
			},
			"",
		]
	>
>

type ApplyUnknownStatement = SqlApply<SqlDatabase<"public">, `create view v as select 1; drop table users`>
type _ApplyUnknownStatement = Expect<
	Matches<ApplyUnknownStatement, [SqlParseError<"Unknown sql statement">, "drop table users"]>
>

describe("sql apply", () => {
	it("should run", () => {})
})
