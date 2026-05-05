import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"

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
			columns: { id: "serial"; big: "bigserial"; small: "smallserial" }
			column_facts: { id: { not_null: true }; big: { not_null: true }; small: { not_null: true } }
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
			columns: { created: "timestamptz"; time: "timetz" }
			column_facts: { created: { not_null: true }; time: { not_null: true } }
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
			columns: { id: "integer"; data: "bytea" }
			column_facts: { id: { not_null: true }; data: { not_null: true } }
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
			columns: { id: "integer"; duration: "interval" }
			column_facts: { id: { not_null: true }; duration: { not_null: true } }
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
			columns: { id: "integer"; ip: "inet"; subnet: "cidr" }
			column_facts: { id: { not_null: true }; ip: { not_null: true }; subnet: { not_null: true } }
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
			columns: { id: "integer"; vec: "tsvector"; query: "tsquery" }
			column_facts: { id: { not_null: true }; vec: { not_null: true }; query: { not_null: true } }
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
				id: "serial"
				created: "timestamptz"
				data: "bytea"
				duration: "interval"
				ip: "inet"
				search: "tsvector"
			}
			column_facts: {
				id: { not_null: true }
				created: { not_null: true }
				data: { not_null: true }
				duration: { not_null: true }
				ip: { not_null: true }
				search: { not_null: true }
			}
		}
	>
>

describe("parse-create-table-postgresql-types (type tests)", () => {
	it("compile-time assertions above", () => {})
})
