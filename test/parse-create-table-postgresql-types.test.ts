import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import { expectType, toBe, type Expect, type Extends } from "./test-utils/type-test-utils.ts"
import type {
	TInteger,
	TSerial,
	TBigserial,
	TSmallserial,
	TTimestamptz,
	TTimetz,
	TBytea,
	TInterval,
	TInet,
	TCidr,
	TTsvector,
	TTsquery,
} from "./test-utils/sql-type-helpers.ts"

type DbPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

// Test serial types
type TSerialStmt = ParseSqlStatement<
	CreateParserMonad<`create table counters (id serial not null, big bigserial not null, small smallserial not null);`>,
	DbPublic
>
type TSerialTable = TSerialStmt[1]["schemas"]["public"]["sets"]["counters"]
expectType<TSerialStmt[2]>(toBe<null>())
type _tSerialShape = Expect<
	Extends<
		TSerialTable,
		{
			kind: "table"
			columns: {
				id: TSerial
				big: TBigserial
				small: TSmallserial
			}
			column_facts: {
				id: { nullability: "not_null" }
				big: { nullability: "not_null" }
				small: { nullability: "not_null" }
			}
		}
	>
>

// Test timestamptz and timetz aliases
type TTimestampAliases = ParseSqlStatement<
	CreateParserMonad<`create table events (created timestamptz not null, time timetz not null);`>,
	DbPublic
>
type TTimestampAliasesTable = TTimestampAliases[1]["schemas"]["public"]["sets"]["events"]
expectType<TTimestampAliases[2]>(toBe<null>())
type _tTimestampAliasesShape = Expect<
	Extends<
		TTimestampAliasesTable,
		{
			kind: "table"
			columns: {
				created: TTimestamptz
				time: TTimetz
			}
			column_facts: { created: { nullability: "not_null" }; time: { nullability: "not_null" } }
		}
	>
>

// Test bytea
type TByteaStmt = ParseSqlStatement<
	CreateParserMonad<`create table files (id integer not null, data bytea not null);`>,
	DbPublic
>
type TByteaTable = TByteaStmt[1]["schemas"]["public"]["sets"]["files"]
expectType<TByteaStmt[2]>(toBe<null>())
type _tByteaShape = Expect<
	Extends<
		TByteaTable,
		{
			kind: "table"
			columns: { id: TInteger; data: TBytea }
			column_facts: { id: { nullability: "not_null" }; data: { nullability: "not_null" } }
		}
	>
>

// Test interval
type TIntervalStmt = ParseSqlStatement<
	CreateParserMonad<`create table durations (id integer not null, duration interval not null);`>,
	DbPublic
>
type TIntervalTable = TIntervalStmt[1]["schemas"]["public"]["sets"]["durations"]
expectType<TIntervalStmt[2]>(toBe<null>())
type _tIntervalShape = Expect<
	Extends<
		TIntervalTable,
		{
			kind: "table"
			columns: { id: TInteger; duration: TInterval }
			column_facts: { id: { nullability: "not_null" }; duration: { nullability: "not_null" } }
		}
	>
>

// Test inet and cidr
type TNetwork = ParseSqlStatement<
	CreateParserMonad<`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`>,
	DbPublic
>
type TNetworkTable = TNetwork[1]["schemas"]["public"]["sets"]["hosts"]
expectType<TNetwork[2]>(toBe<null>())
type _tNetworkShape = Expect<
	Extends<
		TNetworkTable,
		{
			kind: "table"
			columns: {
				id: TInteger
				ip: TInet
				subnet: TCidr
			}
			column_facts: {
				id: { nullability: "not_null" }
				ip: { nullability: "not_null" }
				subnet: { nullability: "not_null" }
			}
		}
	>
>

// Test tsvector and tsquery
type TFulltext = ParseSqlStatement<
	CreateParserMonad<`create table documents (id integer not null, vec tsvector not null, query tsquery not null);`>,
	DbPublic
>
type TFulltextTable = TFulltext[1]["schemas"]["public"]["sets"]["documents"]
expectType<TFulltext[2]>(toBe<null>())
type _tFulltextShape = Expect<
	Extends<
		TFulltextTable,
		{
			kind: "table"
			columns: {
				id: TInteger
				vec: TTsvector
				query: TTsquery
			}
			column_facts: {
				id: { nullability: "not_null" }
				vec: { nullability: "not_null" }
				query: { nullability: "not_null" }
			}
		}
	>
>

// Test mixed PostgreSQL types
type TMixed = ParseSqlStatement<
	CreateParserMonad<`create table mixed (
		id serial not null,
		created timestamptz not null,
		data bytea not null,
		duration interval not null,
		ip inet not null,
		search tsvector not null
	);`>,
	DbPublic
>
type TMixedTable = TMixed[1]["schemas"]["public"]["sets"]["mixed"]
expectType<TMixed[2]>(toBe<null>())
type _tMixedShape = Expect<
	Extends<
		TMixedTable,
		{
			kind: "table"
			columns: {
				id: TSerial
				created: TTimestamptz
				data: TBytea
				duration: TInterval
				ip: TInet
				search: TTsvector
			}
			column_facts: {
				id: { nullability: "not_null" }
				created: { nullability: "not_null" }
				data: { nullability: "not_null" }
				duration: { nullability: "not_null" }
				ip: { nullability: "not_null" }
				search: { nullability: "not_null" }
			}
		}
	>
>

describe("parse-create-table-postgresql-types (type tests)", () => {
	it("compile-time assertions above", () => {})
})
