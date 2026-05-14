import { describe, it } from "node:test"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TInteger, TTextArray } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

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
type TAnyArray = ParseSqlStatement<CreateParserMonad<`select * from items where id = any(array[1,2,3]);`>, DbAnyAll>
type _tAnyArray = Expect<
	Extends<TAnyArray[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = ANY with column array
type TAnyColumn = ParseSqlStatement<CreateParserMonad<`select * from items where 'important' = any(tags);`>, DbAnyAll>
type _tAnyColumn = Expect<
	Extends<TAnyColumn[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = ALL with array
type TAllArray = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority = all(array[1,1,1]);`>,
	DbAnyAll
>
type _tAllArray = Expect<
	Extends<TAllArray[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test = SOME with array (alias for ANY)
type TSomeArray = ParseSqlStatement<CreateParserMonad<`select * from items where id = some(array[5,6,7]);`>, DbAnyAll>
type _tSomeArray = Expect<
	Extends<TSomeArray[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test < ANY with array
type TLessThanAny = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority < any(array[10,20,30]);`>,
	DbAnyAll
>
type _tLessThanAny = Expect<
	Extends<TLessThanAny[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test > ALL with array
type TGreaterThanAll = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority > all(array[1,2,3]);`>,
	DbAnyAll
>
type _tGreaterThanAll = Expect<
	Extends<TGreaterThanAll[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test ANY with subquery
type TAnySubquery = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority = any(select value from priorities);`>,
	DbAnyAll
>
type _tAnySubquery = Expect<
	Extends<TAnySubquery[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test ALL with subquery
type TAllSubquery = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority >= all(select value from priorities);`>,
	DbAnyAll
>
type _tAllSubquery = Expect<
	Extends<TAllSubquery[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

// Test SOME with subquery
type TSomeSubquery = ParseSqlStatement<
	CreateParserMonad<`select * from items where priority = some(select value from priorities);`>,
	DbAnyAll
>
type _tSomeSubquery = Expect<
	Extends<TSomeSubquery[2], { kind: "select"; returning: { id: TInteger; tags: TTextArray; priority: TInteger } }>
>

describe("any-all-some-operators (type tests)", () => {
	it("compile-time assertions above", () => {})
})
