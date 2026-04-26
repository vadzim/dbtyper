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
					distinct: false
					columns: "star"
					from: { primary: ["b", "a"]; joins: [] }
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
					distinct: false
					columns: [{ name: "x" }, { name: "y" }]
					from: { primary: ["t"]; joins: [] }
				},
			],
		]
	>
>

/** Buffer after the `select` keyword; stop at `;`. */
type AfterSelectSemicolon = ParseSelect<ParseSqlTokens<"* from app.users;">>
type _AfterSelectSemicolon = Expect<
	Matches<
		AfterSelectSemicolon,
		[EmptyTokenList, { kind: "select"; distinct: false; columns: "star"; from: { primary: ["users", "app"]; joins: [] } }]
	>
>

/** Subselect end: `)`; rest is after the closing paren. */
type AfterSelectParen = ParseSelect<ParseSqlTokens<"* from t )">>
type _AfterSelectParen = Expect<
	Matches<
		AfterSelectParen,
		[ParseSqlTokens<"">, { kind: "select"; distinct: false; columns: "star"; from: { primary: ["t"]; joins: [] } }]
	>
>

type _ParenRestIsEmpty = Expect<Matches<AfterSelectParen[0], ParseSqlTokens<"">>>

type DistinctStar = ParseSelect<ParseSqlTokens<"distinct * from t;">>
type _DistinctStar = Expect<
	Matches<DistinctStar, [EmptyTokenList, { kind: "select"; distinct: true; columns: "star"; from: { primary: ["t"]; joins: [] } }]>
>

type SelectThenComma = ParseSqlTokens<"select a, b from t;">
type _TopLevelStillWorks = Expect<
	Matches<
		ParseSqlStatements<SelectThenComma>,
		[
			EmptyTokenList,
			[{ kind: "select"; distinct: false; columns: [{ name: "a" }, { name: "b" }]; from: { primary: ["t"]; joins: [] } }],
		]
	>
>

describe("sql select parse (type tests)", () => {
	it("should run", () => {})
})
