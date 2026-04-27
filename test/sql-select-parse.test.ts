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
					from: { primary: { table: ["b", "a"]; alias: "b" }; joins: [] }
					queryParams: {}
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
					from: { primary: { table: ["t"]; alias: "t" }; joins: [] }
					queryParams: {}
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
		[
			EmptyTokenList,
			{
				kind: "select"
				distinct: false
				columns: "star"
				from: { primary: { table: ["users", "app"]; alias: "users" }; joins: [] }
				queryParams: {}
			},
		]
	>
>

/** Subselect end: `)`; rest is after the closing paren. */
type AfterSelectParen = ParseSelect<ParseSqlTokens<"* from t )">>
type _AfterSelectParen = Expect<
	Matches<
		AfterSelectParen,
		[
			ParseSqlTokens<"">,
			{
				kind: "select"
				distinct: false
				columns: "star"
				from: { primary: { table: ["t"]; alias: "t" }; joins: [] }
				queryParams: {}
			},
		]
	>
>

type _ParenRestIsEmpty = Expect<Matches<AfterSelectParen[0], ParseSqlTokens<"">>>

type DistinctStar = ParseSelect<ParseSqlTokens<"distinct * from t;">>
type _DistinctStar = Expect<
	Matches<
		DistinctStar,
		[
			EmptyTokenList,
			{
				kind: "select"
				distinct: true
				columns: "star"
				from: { primary: { table: ["t"]; alias: "t" }; joins: [] }
				queryParams: {}
			},
		]
	>
>

type SelectThenComma = ParseSqlTokens<"select a, b from t;">
type _TopLevelStillWorks = Expect<
	Matches<
		ParseSqlStatements<SelectThenComma>,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					distinct: false
					columns: [{ name: "a" }, { name: "b" }]
					from: { primary: { table: ["t"]; alias: "t" }; joins: [] }
					queryParams: {}
				},
			],
		]
	>
>

/** Primary bare alias: `t u` and qualified projection `u.x`. */
type PrimaryBareAlias = ParseSqlStatements<ParseSqlTokens<"select u.x from t u;">>
type _PrimaryBareAlias = Expect<
	Matches<
		PrimaryBareAlias,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					distinct: false
					columns: [{ name: "x"; table: "u" }]
					from: { primary: { table: ["t"]; alias: "u" }; joins: [] }
					queryParams: {}
				},
			],
		]
	>
>

type StarFromWithAs = ParseSqlStatements<ParseSqlTokens<"select * from t as u;">>
type _StarFromWithAs = Expect<
	Matches<
		StarFromWithAs,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					distinct: false
					columns: "star"
					from: { primary: { table: ["t"]; alias: "u" }; joins: [] }
					queryParams: {}
				},
			],
		]
	>
>

/** Named parameters in WHERE; `queryParams` maps names to column context. */
type NamedParamsSelect = ParseSqlStatements<ParseSqlTokens<"select a from t where b = :bb and c = :cc;">>
type _NamedParamsSelect = Expect<
	Matches<
		NamedParamsSelect,
		[
			EmptyTokenList,
			[
				{
					kind: "select"
					distinct: false
					columns: [{ name: "a" }]
					from: { primary: { table: ["t"]; alias: "t" }; joins: [] }
					where: readonly [
						{
							kind: "eq"
							left: { kind: "col"; ref: { column: "b" } }
							right: { kind: "param"; name: "bb" }
						},
						{
							kind: "eq"
							left: { kind: "col"; ref: { column: "c" } }
							right: { kind: "param"; name: "cc" }
						},
					]
					queryParams: {
						bb: { kind: "eq_rhs"; compareTo: { column: "b" } }
						cc: { kind: "eq_rhs"; compareTo: { column: "c" } }
					}
				},
			],
		]
	>
>

type JoinWithAs = ParseSqlStatements<ParseSqlTokens<"select o.title from users join orders as o on users.id = o.uid;">>
/** `join orders as o` → inner + alias `o` and table `orders`. */
type ParseJoinAsAlias = JoinWithAs[1] extends [infer S]
	? S extends { from: { joins: readonly [infer J] } }
		? J extends { kind: "inner"; table: ["orders"]; alias: "o" }
			? true
			: false
		: false
	: false
type _JoinWithAs = Expect<ParseJoinAsAlias>

describe("sql select parse (type tests)", () => {
	it("should run", () => {})
})
