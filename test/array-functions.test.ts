import { describe, it } from "node:test"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TInteger, TTextArray, TIntegerArray, TUnknown } from "./test-utils/sql-type-helpers.ts"

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

// Test array_length function
type TArrayLength = ParseSqlStatement<CreateParserMonad<`select array_length(tags, 1) as len from items;`>, DbArrays>
type _tArrayLength = Expect<Extends<TArrayLength[2], { kind: "select"; returning: { len: TInteger } }>>

// Test array_append function
type TArrayAppend = ParseSqlStatement<
	CreateParserMonad<`select array_append(tags, 'new') as appended from items;`>,
	DbArrays
>
type _tArrayAppend = Expect<Extends<TArrayAppend[2], { kind: "select"; returning: { appended: TUnknown } }>>

// Test array_prepend function
type TArrayPrepend = ParseSqlStatement<
	CreateParserMonad<`select array_prepend('first', tags) as prepended from items;`>,
	DbArrays
>
type _tArrayPrepend = Expect<Extends<TArrayPrepend[2], { kind: "select"; returning: { prepended: TUnknown } }>>

// Test unnest function
type TUnnest = ParseSqlStatement<CreateParserMonad<`select unnest(tags) as tag from items;`>, DbArrays>
type _tUnnest = Expect<Extends<TUnnest[2], { kind: "select"; returning: { tag: TUnknown } }>>

// Test array_length with integer array
type TArrayLengthInt = ParseSqlStatement<
	CreateParserMonad<`select array_length(nums, 1) as num_len from items;`>,
	DbArrays
>
type _tArrayLengthInt = Expect<Extends<TArrayLengthInt[2], { kind: "select"; returning: { num_len: TInteger } }>>

// Test array_append with integer array
type TArrayAppendInt = ParseSqlStatement<
	CreateParserMonad<`select array_append(nums, 42) as nums_appended from items;`>,
	DbArrays
>
type _tArrayAppendInt = Expect<Extends<TArrayAppendInt[2], { kind: "select"; returning: { nums_appended: TUnknown } }>>

// Test array functions with ARRAY constructor
type TArrayLengthLiteral = ParseSqlStatement<
	CreateParserMonad<`select array_length(array['a','b','c'], 1) as literal_len from items;`>,
	DbArrays
>
type _tArrayLengthLiteral = Expect<
	Extends<TArrayLengthLiteral[2], { kind: "select"; returning: { literal_len: TInteger } }>
>

// Test nested array functions
type TNestedArrayFns = ParseSqlStatement<
	CreateParserMonad<`select array_length(array_append(tags, 'extra'), 1) as nested_len from items;`>,
	DbArrays
>
type _tNestedArrayFns = Expect<Extends<TNestedArrayFns[2], { kind: "select"; returning: { nested_len: TInteger } }>>

describe("array-functions (type tests)", () => {
	it("compile-time assertions above", () => {})
})
