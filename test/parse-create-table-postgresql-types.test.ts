import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TBigint,
	TBoolean,
	TNumeric,
	TUuid,
	TTimestamp,
	TDate,
} from "./test-utils/sql-type-helpers.ts"

type DbPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

// Test serial types
type TSerial = ParseSqlStatement<
	ParseSqlTokens<`create table counters (id serial not null, big bigserial not null, small smallserial not null);`>,
	DbPublic
>
type TSerialTable = TSerial[1]["schemas"]["public"]["sets"]["counters"]
type _tSerialNull = Expect<Matches<TSerial[2], null>>
type _tSerialShape = Expect<
	Extends<
		TSerialTable,
		{
			kind: "table"
			columns: {
				id: { type: "serial"; arg: null; nullable: false }
				big: { type: "bigserial"; arg: null; nullable: false }
				small: { type: "smallserial"; arg: null; nullable: false }
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
	ParseSqlTokens<`create table events (created timestamptz not null, time timetz not null);`>,
	DbPublic
>
type TTimestampAliasesTable = TTimestampAliases[1]["schemas"]["public"]["sets"]["events"]
type _tTimestampAliasesNull = Expect<Matches<TTimestampAliases[2], null>>
type _tTimestampAliasesShape = Expect<
	Extends<
		TTimestampAliasesTable,
		{
			kind: "table"
			columns: {
				created: { type: "timestamptz"; arg: null; nullable: false }
				time: { type: "timetz"; arg: null; nullable: false }
			}
			column_facts: { created: { nullability: "not_null" }; time: { nullability: "not_null" } }
		}
	>
>

// Test bytea
type TBytea = ParseSqlStatement<
	ParseSqlTokens<`create table files (id integer not null, data bytea not null);`>,
	DbPublic
>
type TByteaTable = TBytea[1]["schemas"]["public"]["sets"]["files"]
type _tByteaNull = Expect<Matches<TBytea[2], null>>
type _tByteaShape = Expect<
	Extends<
		TByteaTable,
		{
			kind: "table"
			columns: { id: TInteger; data: { type: "bytea"; arg: null; nullable: false } }
			column_facts: { id: { nullability: "not_null" }; data: { nullability: "not_null" } }
		}
	>
>

// Test interval
type TInterval = ParseSqlStatement<
	ParseSqlTokens<`create table durations (id integer not null, duration interval not null);`>,
	DbPublic
>
type TIntervalTable = TInterval[1]["schemas"]["public"]["sets"]["durations"]
type _tIntervalNull = Expect<Matches<TInterval[2], null>>
type _tIntervalShape = Expect<
	Extends<
		TIntervalTable,
		{
			kind: "table"
			columns: { id: TInteger; duration: { type: "interval"; arg: null; nullable: false } }
			column_facts: { id: { nullability: "not_null" }; duration: { nullability: "not_null" } }
		}
	>
>

// Test inet and cidr
type TNetwork = ParseSqlStatement<
	ParseSqlTokens<`create table hosts (id integer not null, ip inet not null, subnet cidr not null);`>,
	DbPublic
>
type TNetworkTable = TNetwork[1]["schemas"]["public"]["sets"]["hosts"]
type _tNetworkNull = Expect<Matches<TNetwork[2], null>>
type _tNetworkShape = Expect<
	Extends<
		TNetworkTable,
		{
			kind: "table"
			columns: {
				id: TInteger
				ip: { type: "inet"; arg: null; nullable: false }
				subnet: { type: "cidr"; arg: null; nullable: false }
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
	ParseSqlTokens<`create table documents (id integer not null, vec tsvector not null, query tsquery not null);`>,
	DbPublic
>
type TFulltextTable = TFulltext[1]["schemas"]["public"]["sets"]["documents"]
type _tFulltextNull = Expect<Matches<TFulltext[2], null>>
type _tFulltextShape = Expect<
	Extends<
		TFulltextTable,
		{
			kind: "table"
			columns: {
				id: TInteger
				vec: { type: "tsvector"; arg: null; nullable: false }
				query: { type: "tsquery"; arg: null; nullable: false }
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
	ParseSqlTokens<`create table mixed (
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
type _tMixedNull = Expect<Matches<TMixed[2], null>>
type _tMixedShape = Expect<
	Extends<
		TMixedTable,
		{
			kind: "table"
			columns: {
				id: { type: "serial"; arg: null; nullable: false }
				created: { type: "timestamptz"; arg: null; nullable: false }
				data: { type: "bytea"; arg: null; nullable: false }
				duration: { type: "interval"; arg: null; nullable: false }
				ip: { type: "inet"; arg: null; nullable: false }
				search: { type: "tsvector"; arg: null; nullable: false }
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
