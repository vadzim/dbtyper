/**
 * `SelectRow` and `ApplySelect` against a small `SqlDatabaseLike` shape.
 */
import { describe, it } from "node:test"
import type { ApplySelect } from "../src/engine/apply-select.ts"
import type { SelectRow } from "../src/engine/infer-select-row.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { SqlApplyStatement } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type SmallDb = {
	defaultSchema: "public"
	schemas: {
		public: { tables: { t: { columns: { id: number; name: string } } } }
	}
}

type StarStmt = ParseSqlStatements<ParseSqlTokens<"select * from t;">>[1][0]
type _SelectRowStar = Expect<Matches<SelectRow<SmallDb, StarStmt>, { id: number; name: string }>>

type IdNameStmt = ParseSqlStatements<ParseSqlTokens<"select id, name from t;">>[1][0]
type _SelectRowNamed = Expect<Matches<SelectRow<SmallDb, IdNameStmt>, { id: number; name: string }>>

type BadColStmt = ParseSqlStatements<ParseSqlTokens<"select nope from t;">>[1][0]
type _SelectRowBad = Expect<Matches<SelectRow<SmallDb, BadColStmt>, SqlParserError<`Unknown column "nope" in SELECT`>>>

type _ApplyOk = Expect<Matches<SqlApplyStatement<SmallDb, StarStmt>, SmallDb>>
type _ApplyInvalid = Expect<Matches<SqlApplyStatement<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>
type _ApplySelectDirect = Expect<Matches<ApplySelect<SmallDb, StarStmt>, SmallDb>>
type _ApplySelectBad = Expect<Matches<ApplySelect<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>

describe("sql select infer/apply (type tests)", () => {
	it("should run", () => {})
})
