/**
 * v1 `SELECT` parse: shape, `;` end, `)` for subselect tail, named columns.
 */
import { describe, it } from "node:test"
import type { ParseSelect } from "../src/parser/parse-select.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { EmptyTokenList, ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type OneStmt = ParseSqlStatements<ParseSqlTokens<"select * from a.b;">>
type _OneStmt = Expect<
	Matches<
		OneStmt,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					columns: "star"
					from: ["b", "a"]
				},
			],
		]
	>
>

type NamedCols = ParseSqlStatements<ParseSqlTokens<"select x, y from t;">>
type _NamedCols = Expect<
	Matches<
		NamedCols,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					columns: ["x", "y"]
					from: ["t"]
				},
			],
		]
	>
>

/** Buffer after the `select` keyword; stop at `;`. */
type AfterSelectSemicolon = ParseSelect<ParseSqlTokens<"* from app.users;">>
type _AfterSelectSemicolon = Expect<
	Matches<AfterSelectSemicolon, [EmptyTokenList, { kind: "select"; columns: "star"; from: ["users", "app"] }]>
>

/** Subselect end: `)`; rest is after the closing paren. */
type AfterSelectParen = ParseSelect<ParseSqlTokens<"* from t )">>
type _AfterSelectParen = Expect<
	Matches<AfterSelectParen, [ParseSqlTokens<"">, { kind: "select"; columns: "star"; from: ["t"] }]>
>

type _ParenRestIsEmpty = Expect<Matches<AfterSelectParen[0], ParseSqlTokens<"">>>

type DistinctStar = ParseSelect<ParseSqlTokens<"distinct * from t;">>
type _DistinctStar = Expect<Matches<DistinctStar, [EmptyTokenList, { kind: "select"; columns: "star"; from: ["t"] }]>>

type SelectThenComma = ParseSqlTokens<"select a, b from t;">
type _TopLevelStillWorks = Expect<
	Matches<
		ParseSqlStatements<SelectThenComma>,
		[EmptyTokenList, [{ kind: "select"; columns: ["a", "b"]; from: ["t"] }]]
	>
>

describe("sql select parse (type tests)", () => {
	it("should run", () => {})
})
