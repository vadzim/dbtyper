import { describe, it } from "node:test"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TInteger, TBoolean, TTextArray, TIntegerArray } from "./test-utils/sql-type-helpers.ts"

type DbArrays = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				items: {
					kind: "table"
					columns: { id: TInteger; tags: TTextArray; nums: TIntegerArray }
				}
			}
		}
	}
}

// Test <@ (is contained by) operator
type TContainedBy = ParseSqlStatement<
	CreateParserMonad<`select tags <@ array['a','b','c'] as contained from items;`>,
	DbArrays
>
type _tContainedBy = Expect<Extends<TContainedBy[2], { kind: "select"; columns: { contained: TBoolean } }>>

// Test @> (contains) operator
type TContains = ParseSqlStatement<CreateParserMonad<`select tags @> array['a'] as contains from items;`>, DbArrays>
type _tContains = Expect<Extends<TContains[2], { kind: "select"; columns: { contains: TBoolean } }>>

// Test && (overlaps) operator
type TOverlaps = ParseSqlStatement<CreateParserMonad<`select tags && array['a','b'] as overlaps from items;`>, DbArrays>
type _tOverlaps = Expect<Extends<TOverlaps[2], { kind: "select"; columns: { overlaps: TBoolean } }>>

// Test = (array equality) operator
type TEquals = ParseSqlStatement<CreateParserMonad<`select tags = array['a','b'] as equals from items;`>, DbArrays>
type _tEquals = Expect<Extends<TEquals[2], { kind: "select"; columns: { equals: TBoolean } }>>

// Test || (array concatenation) operator
type TConcat = ParseSqlStatement<CreateParserMonad<`select tags || array['new'] as concatenated from items;`>, DbArrays>
type _tConcat = Expect<Extends<TConcat[2], { kind: "select"; columns: { concatenated: TTextArray } }>>

// Test array concatenation with column
type TConcatColumn = ParseSqlStatement<CreateParserMonad<`select tags || tags as doubled from items;`>, DbArrays>
type _tConcatColumn = Expect<Extends<TConcatColumn[2], { kind: "select"; columns: { doubled: TTextArray } }>>

// Test integer arrays with operators
type TIntArrayOps = ParseSqlStatement<
	CreateParserMonad<`select nums @> array[1,2] as has_nums, nums = array[1,2,3] as exact from items;`>,
	DbArrays
>
type _tIntArrayOps = Expect<
	Extends<TIntArrayOps[2], { kind: "select"; columns: { has_nums: TBoolean; exact: TBoolean } }>
>

describe("array-operators (type tests)", () => {
	it("compile-time assertions above", () => {})
})
