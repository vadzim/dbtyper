/**
 * Migration DDL: CREATE INDEX parse shape and apply-time column validation.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../src/engine/sql-database.ts"
import type { SqlApplyStatements } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatementsRecovering } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type ParseIndexOk = ParseSqlStatementsRecovering<
	ParseSqlTokens<`
	create schema app;
	create table app.items (id int not null, name text not null);
	create index items_name_idx on app.items (name, id);
`>
>
type _ParseIndexOk = Expect<
	Matches<
		ParseIndexOk,
		[
			EmptyTokenList,
			[
				{ kind: "create_schema"; name: "app"; ifNotExists: false },
				{
					kind: "create_table"
					name: ["items", "app"]
					row: { id: number; name: string }
					refs: undefined
					intraTableConstraints: []
				},
				{
					kind: "create_index_validated"
					unique: false
					ifNotExists: false
					target: ["items", "app"]
					columns: ["name", "id"]
				},
			],
		]
	>
>

type ApplyIndexBadCol = SqlApplyStatements<
	SqlDatabase<"app">,
	ParseSqlStatementsRecovering<
		ParseSqlTokens<`
		create schema app;
		create table app.t (id int not null);
		create index i on app.t (missing_col);
	`>
	>[1]
>
type _ApplyIndexBadCol = Expect<
	Matches<ApplyIndexBadCol, SqlParserError<`Unknown column "missing_col" in CREATE INDEX`>>
>

describe("sql migration create index (type tests)", () => {
	it("should run", () => {})
})
