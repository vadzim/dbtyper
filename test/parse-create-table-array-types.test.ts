import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"

type DbPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

// Test basic array types
type TTextArray = ParseSqlStatement<
	ParseSqlTokens<`create table tags (id integer not null, labels text[] not null);`>,
	DbPublic
>
type TTextArrayTable = TTextArray[1]["schemas"]["public"]["sets"]["tags"]
type _tTextArrayNull = Expect<Matches<TTextArray[2], null>>
type _tTextArrayShape = Expect<
	Extends<
		TTextArrayTable,
		{
			kind: "table"
			columns: { id: "integer"; labels: "text[]" }
			column_facts: { id: { not_null: true }; labels: { not_null: true } }
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
			columns: { id: "integer"; nums: "integer[]" }
			column_facts: { id: { not_null: true }; nums: { not_null: true } }
		}
	>
>

// Test uuid array
type TUuidArray = ParseSqlStatement<
	ParseSqlTokens<`create table refs (id integer not null, uuids uuid[] not null);`>,
	DbPublic
>
type TUuidArrayTable = TUuidArray[1]["schemas"]["public"]["sets"]["refs"]
type _tUuidArrayNull = Expect<Matches<TUuidArray[2], null>>
type _tUuidArrayShape = Expect<
	Extends<
		TUuidArrayTable,
		{
			kind: "table"
			columns: { id: "integer"; uuids: "uuid[]" }
			column_facts: { id: { not_null: true }; uuids: { not_null: true } }
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
			columns: { id: "integer"; tags: "text[]" }
			column_facts: { id: { not_null: true } }
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
			columns: { id: "integer"; tags: "text[]"; scores: "integer[]"; flags: "boolean[]" }
			column_facts: {
				id: { not_null: true }
				tags: { not_null: true }
				scores: { not_null: true }
				flags: { not_null: true }
			}
		}
	>
>

// Test bigint array
type TBigintArray = ParseSqlStatement<
	ParseSqlTokens<`create table big_nums (id integer not null, nums bigint[] not null);`>,
	DbPublic
>
type TBigintArrayTable = TBigintArray[1]["schemas"]["public"]["sets"]["big_nums"]
type _tBigintArrayNull = Expect<Matches<TBigintArray[2], null>>
type _tBigintArrayShape = Expect<
	Extends<
		TBigintArrayTable,
		{
			kind: "table"
			columns: { id: "integer"; nums: "bigint[]" }
			column_facts: { id: { not_null: true }; nums: { not_null: true } }
		}
	>
>

describe("parse-create-table-array-types (type tests)", () => {
	it("compile-time assertions above", () => {})
})
