import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		auth: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: string }
					column_sql_types: { id: "uuid" }
				}
			}
		}
	}
}

type T1 = ParseSqlStatement<
	ParseSqlTokens<`create table if not exists auth.items ( id uuid not null, body text null );`>,
	DbAuth
>
type T1Table = T1[1]["schemas"]["auth"]["sets"]["items"]
type _t1null = Expect<Matches<T1[2], null>>
type _t1shape = Expect<
	T1Table extends {
		kind: "table"
		columns: { id: string; body: string }
		column_sql_types: { id: "uuid"; body: "text" }
	}
		? true
		: false
>

type T2 = ParseSqlStatement<ParseSqlTokens<`create table if not exists auth.users ( id uuid not null );`>, DbUsers>
type _t2noop = Expect<Matches<T2[2], null>>
type _t2db = Expect<T2[1] extends DbUsers ? (DbUsers extends T2[1] ? true : false) : false>

type DbWithDup = {
	defaultSchema: "public"
	schemas: {
		auth: {
			sets: {
				dup: { kind: "table"; columns: {}; column_sql_types?: {} }
			}
		}
	}
}

type T3 = ParseSqlStatement<ParseSqlTokens<`create table auth.dup ( n int not null );`>, DbWithDup>
type _t3err = Expect<T3[2] extends SqlParserError<string> ? true : false>

type T4 = ParseSqlStatement<
	ParseSqlTokens<`create table logs.events ( at timestamp with time zone not null );`>,
	{
		defaultSchema: "public"
		schemas: { logs: JsqlSchemaShape }
	}
>
type T4Table = T4[1]["schemas"]["logs"]["sets"]["events"]
type _t4null = Expect<Matches<T4[2], null>>
type _t4shape = Expect<
	T4Table extends {
		kind: "table"
		columns: { at: string }
		column_sql_types: { at: "timestamp with time zone" }
	}
		? true
		: false
>

/**
 * Explicit `schema.table` — the table is created under the named schema (`billing`), not
 * `defaultSchema` (`public`). Earlier cases (T1–T4) also use qualified names; these spell that out.
 */
type DbBillingAndPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape; billing: JsqlSchemaShape }
}

type TExplicit = ParseSqlStatement<
	ParseSqlTokens<`create table billing.invoices ( amount numeric not null, note text not null );`>,
	DbBillingAndPublic
>
type TExplicitTable = TExplicit[1]["schemas"]["billing"]["sets"]["invoices"]
type _tExplicitNull = Expect<Matches<TExplicit[2], null>>
type _tExplicitShape = Expect<
	TExplicitTable extends {
		kind: "table"
		columns: { amount: string; note: string }
		column_sql_types: { amount: "numeric"; note: "text" }
	}
		? true
		: false
>

type TExplicitIfNot = ParseSqlStatement<
	ParseSqlTokens<`create table if not exists billing.credits ( id int not null );`>,
	DbBillingAndPublic
>
type TExplicitIfNotTable = TExplicitIfNot[1]["schemas"]["billing"]["sets"]["credits"]
type _tExplicitIfNotNull = Expect<Matches<TExplicitIfNot[2], null>>
type _tExplicitIfNotShape = Expect<
	TExplicitIfNotTable extends {
		kind: "table"
		columns: { id: number }
		column_sql_types: { id: "int" }
	}
		? true
		: false
>

type TExplicitUnknownSchema = ParseSqlStatement<
	ParseSqlTokens<`create table missing_schema.widgets ( id uuid not null );`>,
	DbBillingAndPublic
>
type _tExplicitUnknownSchema = Expect<TExplicitUnknownSchema[2] extends SqlParserError<string> ? true : false>

/** DB whose default schema is `public` and that schema exists (unqualified names land here). */
type DbDefaultPublic = {
	defaultSchema: "public"
	schemas: { public: JsqlSchemaShape }
}

type T5 = ParseSqlStatement<
	ParseSqlTokens<`create table notifications ( id uuid not null, title text not null );`>,
	DbDefaultPublic
>
type T5Table = T5[1]["schemas"]["public"]["sets"]["notifications"]
type _t5null = Expect<Matches<T5[2], null>>
type _t5shape = Expect<
	T5Table extends {
		kind: "table"
		columns: { id: string; title: string }
		column_sql_types: { id: "uuid"; title: "text" }
	}
		? true
		: false
>

type T6 = ParseSqlStatement<
	ParseSqlTokens<`create table if not exists notifications ( id uuid not null, title text not null );`>,
	DbDefaultPublic
>
type T6Table = T6[1]["schemas"]["public"]["sets"]["notifications"]
type _t6null = Expect<Matches<T6[2], null>>
type _t6shape = Expect<
	T6Table extends {
		kind: "table"
		columns: { id: string; title: string }
		column_sql_types: { id: "uuid"; title: "text" }
	}
		? true
		: false
>

type TExpectedTableName = ParseSqlStatement<ParseSqlTokens<`create table( id int not null );`>, DbDefaultPublic>
type _expectedTableName = Expect<
	TExpectedTableName[2] extends SqlParserError<"Expected table name in CREATE TABLE"> ? true : false
>

type TDupWithoutIfNot = ParseSqlStatement<ParseSqlTokens<`create table auth.dup ( x int not null );`>, DbWithDup>
type _dupNoIfNot = Expect<Matches<TDupWithoutIfNot[2], SqlParserError<"Table already exists; use IF NOT EXISTS">>>

type TGarbageAfterClose = ParseSqlStatement<
	ParseSqlTokens<`create table n ( id int not null) extra ;`>,
	DbDefaultPublic
>
type _garbageAfterClose = Expect<
	TGarbageAfterClose[2] extends SqlParserError<"Expected `;` after CREATE TABLE"> ? true : false
>

type TUnknownQualifiedSchema = ParseSqlStatement<
	ParseSqlTokens<`create table zzz.ghost ( id int not null );`>,
	DbDefaultPublic
>
type _unknownQualifiedSchema = Expect<
	TUnknownQualifiedSchema[2] extends SqlParserError<"Unknown schema for CREATE TABLE"> ? true : false
>

type TMissingOpenParen = ParseSqlStatement<ParseSqlTokens<`create table t id int not null);`>, DbDefaultPublic>
type _missingOpenParen = Expect<
	TMissingOpenParen[2] extends SqlParserError<"Expected `.` or `(` after table name"> ? true : false
>

describe("parse-create-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
