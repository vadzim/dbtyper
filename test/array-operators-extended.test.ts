import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbArrays = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				items: {
					kind: "table"
					columns: { id: "integer"; tags: "text[]"; nums: "integer[]" }
				}
			}
		}
	}
	scalarTypes: Record<string, unknown>
} & JsqlDatabaseShape

// Test <@ (is contained by) operator
type TContainedBy = ParseSqlStatement<
	ParseSqlTokens<`select tags <@ array['a','b','c'] as contained from items;`>,
	DbArrays
>
type _tContainedBy = Expect<Extends<Tuple3At2<TContainedBy>, { kind: "select"; columns: { contained: "boolean" } }>>

// Test @> (contains) operator
type TContains = ParseSqlStatement<ParseSqlTokens<`select tags @> array['a'] as contains from items;`>, DbArrays>
type _tContains = Expect<Extends<Tuple3At2<TContains>, { kind: "select"; columns: { contains: "boolean" } }>>

// Test && (overlaps) operator
type TOverlaps = ParseSqlStatement<ParseSqlTokens<`select tags && array['a','b'] as overlaps from items;`>, DbArrays>
type _tOverlaps = Expect<Extends<Tuple3At2<TOverlaps>, { kind: "select"; columns: { overlaps: "boolean" } }>>

// Test = (array equality) operator
type TEquals = ParseSqlStatement<ParseSqlTokens<`select tags = array['a','b'] as equals from items;`>, DbArrays>
type _tEquals = Expect<Extends<Tuple3At2<TEquals>, { kind: "select"; columns: { equals: "boolean" } }>>

// Test || (array concatenation) operator
type TConcat = ParseSqlStatement<ParseSqlTokens<`select tags || array['new'] as concatenated from items;`>, DbArrays>
type _tConcat = Expect<Extends<Tuple3At2<TConcat>, { kind: "select"; columns: { concatenated: "unknown" } }>>

// Test array concatenation with column
type TConcatColumn = ParseSqlStatement<ParseSqlTokens<`select tags || tags as doubled from items;`>, DbArrays>
type _tConcatColumn = Expect<Extends<Tuple3At2<TConcatColumn>, { kind: "select"; columns: { doubled: "unknown" } }>>

// Test integer arrays with operators
type TIntArrayOps = ParseSqlStatement<
	ParseSqlTokens<`select nums @> array[1,2] as has_nums, nums = array[1,2,3] as exact from items;`>,
	DbArrays
>
type _tIntArrayOps = Expect<
	Extends<Tuple3At2<TIntArrayOps>, { kind: "select"; columns: { has_nums: "boolean"; exact: "boolean" } }>
>

describe("array-operators (type tests)", () => {
	it("compile-time assertions above", () => {})
})
