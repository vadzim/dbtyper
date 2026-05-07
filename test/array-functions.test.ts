import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"

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
}

// Test array_length function
type TArrayLength = ParseSqlStatement<ParseSqlTokens<`select array_length(tags, 1) as len from items;`>, DbArrays>
type _tArrayLength = Expect<Extends<Tuple3At2<TArrayLength>, { kind: "select"; columns: { len: "integer" } }>>

// Test array_append function
type TArrayAppend = ParseSqlStatement<
	ParseSqlTokens<`select array_append(tags, 'new') as appended from items;`>,
	DbArrays
>
type _tArrayAppend = Expect<Extends<Tuple3At2<TArrayAppend>, { kind: "select"; columns: { appended: "unknown" } }>>

// Test array_prepend function
type TArrayPrepend = ParseSqlStatement<
	ParseSqlTokens<`select array_prepend('first', tags) as prepended from items;`>,
	DbArrays
>
type _tArrayPrepend = Expect<Extends<Tuple3At2<TArrayPrepend>, { kind: "select"; columns: { prepended: "unknown" } }>>

// Test unnest function
type TUnnest = ParseSqlStatement<ParseSqlTokens<`select unnest(tags) as tag from items;`>, DbArrays>
type _tUnnest = Expect<Extends<Tuple3At2<TUnnest>, { kind: "select"; columns: { tag: "unknown" } }>>

// Test array_length with integer array
type TArrayLengthInt = ParseSqlStatement<
	ParseSqlTokens<`select array_length(nums, 1) as num_len from items;`>,
	DbArrays
>
type _tArrayLengthInt = Expect<Extends<Tuple3At2<TArrayLengthInt>, { kind: "select"; columns: { num_len: "integer" } }>>

// Test array_append with integer array
type TArrayAppendInt = ParseSqlStatement<
	ParseSqlTokens<`select array_append(nums, 42) as nums_appended from items;`>,
	DbArrays
>
type _tArrayAppendInt = Expect<
	Extends<Tuple3At2<TArrayAppendInt>, { kind: "select"; columns: { nums_appended: "unknown" } }>
>

// Test array functions with ARRAY constructor
type TArrayLengthLiteral = ParseSqlStatement<
	ParseSqlTokens<`select array_length(array['a','b','c'], 1) as literal_len from items;`>,
	DbArrays
>
type _tArrayLengthLiteral = Expect<
	Extends<Tuple3At2<TArrayLengthLiteral>, { kind: "select"; columns: { literal_len: "integer" } }>
>

// Test nested array functions
type TNestedArrayFns = ParseSqlStatement<
	ParseSqlTokens<`select array_length(array_append(tags, 'extra'), 1) as nested_len from items;`>,
	DbArrays
>
type _tNestedArrayFns = Expect<
	Extends<Tuple3At2<TNestedArrayFns>, { kind: "select"; columns: { nested_len: "integer" } }>
>

// Test error: array_length with non-array argument
type TArrayLengthBadArgs = ParseSqlStatement<ParseSqlTokens<`select array_length(id, 1) as bad from items;`>, DbArrays>
type _tArrayLengthBadArgs = Expect<Extends<Tuple3At2<TArrayLengthBadArgs>, SqlParserError<string>>>

// Test error: unnest with non-array argument
type TUnnestBadArgs = ParseSqlStatement<ParseSqlTokens<`select unnest(id) as bad from items;`>, DbArrays>
type _tUnnestBadArgs = Expect<Extends<Tuple3At2<TUnnestBadArgs>, SqlParserError<string>>>

describe("array-functions (type tests)", () => {
	it("compile-time assertions above", () => {})
})
