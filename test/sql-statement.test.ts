import { describe, it } from "node:test"
import { sqlDatabase, sqlStatement } from "../src/engine/sql-database.ts"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import assert from "node:assert"

// --- sqlStatement: brands a string with its parsed type ---

type CreateUsersStatement = ReturnType<typeof sqlStatement<"create table users (id int not null, name text)">>

type _CreateUsersStatementParsedType = Expect<
	Matches<
		CreateUsersStatement["parsedSql"],
		ParseSqlStatementsRecovering<ParseSqlTokens<"create table users (id int not null, name text)">>[1]
	>
>

type _CreateUsersStatementParsedShape = Expect<
	Matches<
		CreateUsersStatement["parsedSql"],
		[
			{
				kind: "create_table"
				name: ["users"]
				row: { id: number; name: string | null }
				refs: undefined
				intraTableConstraints: []
			},
		]
	>
>

// --- sqlDatabase().apply(): only accepts branded strings, not plain strings ---

describe("sql statement", () => {
	it("should run", async () => {
		const db = await sqlDatabase("public")
			.apply(sqlStatement("create schema public"))
			.apply(sqlStatement("create table users (id int not null, name text)"))
			.compile()

		type _DbShape = Expect<
			Matches<
				typeof db.$db,
				{
					defaultSchema: "public"
					schemas: {
						public: {
							tables: {
								users: {
									columns: {
										id: number
										name: string | null
									}
								}
							}
						}
					}
				}
			>
		>

		assert.deepEqual(db.migrations, [
			{ source: "create schema public", path: "" },
			{ source: "create table users (id int not null, name text)", path: "" },
		])
	})
})
