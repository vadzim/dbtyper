import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TBigint,
	TBoolean,
	TNumeric,
	TUuid,
	TTimestamp,
	TDate,
	TTextArray,
	TIntegerArray,
	TBigintArray,
	TBooleanArray,
	TNumericArray,
	TUuidArray,
} from "./test-utils/sql-type-helpers.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"

type DbAnyAll = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				items: {
					kind: "table"
					columns: { id: TInteger; tags: TTextArray; priority: TInteger }
				}
				priorities: {
					kind: "table"
					columns: { value: TInteger }
				}
			}
		}
	}
}

// Test = ANY with array
type TAnyArray = ParseSqlStatement<ParseSqlTokens<`select * from items where id = any(array[1,2,3]);`>, DbAnyAll>
type _tAnyArray = Expect<
	Extends<Tuple3At2<TAnyArray>, { kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = ANY with column array
type TAnyColumn = ParseSqlStatement<ParseSqlTokens<`select * from items where 'important' = any(tags);`>, DbAnyAll>
type _tAnyColumn = Expect<
	Extends<Tuple3At2<TAnyColumn>, { kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = ALL with array
type TAllArray = ParseSqlStatement<ParseSqlTokens<`select * from items where priority = all(array[1,1,1]);`>, DbAnyAll>
type _tAllArray = Expect<
	Extends<Tuple3At2<TAllArray>, { kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = SOME with array (alias for ANY)
type TSomeArray = ParseSqlStatement<ParseSqlTokens<`select * from items where id = some(array[5,6,7]);`>, DbAnyAll>
type _tSomeArray = Expect<
	Extends<Tuple3At2<TSomeArray>, { kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test < ANY with array
type TLessThanAny = ParseSqlStatement<
	ParseSqlTokens<`select * from items where priority < any(array[10,20,30]);`>,
	DbAnyAll
>
type _tLessThanAny = Expect<
	Extends<
		Tuple3At2<TLessThanAny>,
		{ kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }
	>
>

// Test > ALL with array
type TGreaterThanAll = ParseSqlStatement<
	ParseSqlTokens<`select * from items where priority > all(array[1,2,3]);`>,
	DbAnyAll
>
type _tGreaterThanAll = Expect<
	Extends<
		Tuple3At2<TGreaterThanAll>,
		{ kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }
	>
>

// Test ANY with subquery
type TAnySubquery = ParseSqlStatement<
	ParseSqlTokens<`select * from items where priority = any(select value from priorities);`>,
	DbAnyAll
>
type _tAnySubquery = Expect<
	Extends<
		Tuple3At2<TAnySubquery>,
		{ kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }
	>
>

// Test ALL with subquery
type TAllSubquery = ParseSqlStatement<
	ParseSqlTokens<`select * from items where priority >= all(select value from priorities);`>,
	DbAnyAll
>
type _tAllSubquery = Expect<
	Extends<
		Tuple3At2<TAllSubquery>,
		{ kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }
	>
>

// Test SOME with subquery
type TSomeSubquery = ParseSqlStatement<
	ParseSqlTokens<`select * from items where priority = some(select value from priorities);`>,
	DbAnyAll
>
type _tSomeSubquery = Expect<
	Extends<
		Tuple3At2<TSomeSubquery>,
		{ kind: "select"; columns: { id: TInteger; tags: TTextArray; priority: TInteger } }
	>
>

// Test error: ANY with non-array
type TAnyNonArray = ParseSqlStatement<ParseSqlTokens<`select * from items where id = any(priority);`>, DbAnyAll>
type _tAnyNonArray = Expect<Extends<Tuple3At2<TAnyNonArray>, SqlParserError<string>>>

describe("any-all-some-operators (type tests)", () => {
	it("compile-time assertions above", () => {})
})
