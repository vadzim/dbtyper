/**
 * Migration DDL: CREATE INDEX parse shape and apply-time column validation.
 */
import { describe, it } from "node:test"
import type { SqlDatabase } from "../engine/sql-database.js"
import type { SqlApplyStatements } from "../engine/apply-statement.js"
import type { ParseSqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { EmptyTokenList, ParseSqlTokens, SqlParserError } from "../parser/sql-tokens.js"
import type { Expect, Matches } from "../test-utils/type-test-utils.js"

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
			readonly [
				{ readonly kind: "create_schema"; readonly name: "app"; readonly ifNotExists: false },
				{
					readonly kind: "create_table"
					readonly name: readonly ["items", "app"]
					readonly row: { id: number; name: string }
					readonly refs: undefined
				},
				{
					readonly kind: "create_index_validated"
					readonly unique: false
					readonly ifNotExists: false
					readonly target: readonly ["items", "app"]
					readonly columns: readonly ["name", "id"]
				},
			],
			EmptyTokenList,
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
	>[0]
>
type _ApplyIndexBadCol = Expect<
	Matches<ApplyIndexBadCol, SqlParserError<`Unknown column "missing_col" in CREATE INDEX`>>
>

describe("sql migration create index (type tests)", () => {
	it("should run", () => {})
})
