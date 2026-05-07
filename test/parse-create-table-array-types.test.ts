import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TTextArray,
	TIntegerArray,
	TBigintArray,
	TBooleanArray,
	TUuidArray,
	TNull,
} from "./test-utils/sql-type-helpers.ts"

type DbPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

// Test basic array types
type TTextArrayStmt = ParseSqlStatement<
	ParseSqlTokens<`create table tags (id integer not null, labels text[] not null);`>,
	DbPublic
>
type TTextArrayTable = TTextArrayStmt[1]["schemas"]["public"]["sets"]["tags"]
type _tTextArrayNull = Expect<Matches<TTextArrayStmt[2], null>>
type _tTextArrayShape = Expect<
	Extends<
		TTextArrayTable,
		{
			kind: "table"
			columns: { id: TInteger; labels: TTextArray }
			column_facts: { id: { nullability: "not_null" }; labels: { nullability: "not_null" } }
		}
	>
>

// Test integer array
type TIntArray = ParseSqlStatement<
	ParseSqlTokens<`create table scores (id integer not null, nums integer[] not null);`>,
	DbPublic
>
type TIntArrayTable = TIntArray[1]["schemas"]["public"]["sets"]["scores"]
type _tIntArrayNull = Expect<Matches<TIntArray[2], null>>
type _tIntArrayShape = Expect<
	Extends<
		TIntArrayTable,
		{
			kind: "table"
			columns: { id: TInteger; nums: TIntegerArray }
			column_facts: { id: { nullability: "not_null" }; nums: { nullability: "not_null" } }
		}
	>
>

// Test uuid array
type TUuidArrayStmt = ParseSqlStatement<
	ParseSqlTokens<`create table refs (id integer not null, uuids uuid[] not null);`>,
	DbPublic
>
type TUuidArrayTable = TUuidArrayStmt[1]["schemas"]["public"]["sets"]["refs"]
type _tUuidArrayNull = Expect<Matches<TUuidArrayStmt[2], null>>
type _tUuidArrayShape = Expect<
	Extends<
		TUuidArrayTable,
		{
			kind: "table"
			columns: { id: TInteger; uuids: TUuidArray }
			column_facts: { id: { nullability: "not_null" }; uuids: { nullability: "not_null" } }
		}
	>
>

// Test nullable array
type TNullableArray = ParseSqlStatement<
	ParseSqlTokens<`create table optional (id integer not null, tags text[]);`>,
	DbPublic
>
type TNullableArrayTable = TNullableArray[1]["schemas"]["public"]["sets"]["optional"]
type _tNullableArrayNull = Expect<Matches<TNullableArray[2], null>>
type _tNullableArrayShape = Expect<
	Extends<
		TNullableArrayTable,
		{
			kind: "table"
			columns: { id: TInteger; tags: TNull<"array", TText> }
			column_facts: { id: { nullability: "not_null" } }
		}
	>
>

// Test multiple array columns
type TMultipleArrays = ParseSqlStatement<
	ParseSqlTokens<`create table multi (id integer not null, tags text[] not null, scores integer[] not null, flags boolean[] not null);`>,
	DbPublic
>
type TMultipleArraysTable = TMultipleArrays[1]["schemas"]["public"]["sets"]["multi"]
type _tMultipleArraysNull = Expect<Matches<TMultipleArrays[2], null>>
type _tMultipleArraysShape = Expect<
	Extends<
		TMultipleArraysTable,
		{
			kind: "table"
			columns: { id: TInteger; tags: TTextArray; scores: TIntegerArray; flags: TBooleanArray }
			column_facts: {
				id: { nullability: "not_null" }
				tags: { nullability: "not_null" }
				scores: { nullability: "not_null" }
				flags: { nullability: "not_null" }
			}
		}
	>
>

// Test bigint array
type TBigintArrayStmt = ParseSqlStatement<
	ParseSqlTokens<`create table big_nums (id integer not null, nums bigint[] not null);`>,
	DbPublic
>
type TBigintArrayTable = TBigintArrayStmt[1]["schemas"]["public"]["sets"]["big_nums"]
type _tBigintArrayNull = Expect<Matches<TBigintArrayStmt[2], null>>
type _tBigintArrayShape = Expect<
	Extends<
		TBigintArrayTable,
		{
			kind: "table"
			columns: { id: TInteger; nums: TBigintArray }
			column_facts: { id: { nullability: "not_null" }; nums: { nullability: "not_null" } }
		}
	>
>

describe("parse-create-table-array-types (type tests)", () => {
	it("compile-time assertions above", () => {})
})
