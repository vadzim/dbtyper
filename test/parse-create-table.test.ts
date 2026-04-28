import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
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
	Extends<
		T1Table,
		{
			kind: "table"
			columns: { id: string; body: string }
			column_sql_types: { id: "uuid"; body: "text" }
		}
	>
>

type T2 = ParseSqlStatement<ParseSqlTokens<`create table if not exists auth.users ( id uuid not null );`>, DbUsers>
type _t2noop = Expect<Matches<T2[2], null>>
type _t2db = Expect<Matches<T2[1], DbUsers>>

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
type _t3err = Expect<Extends<T3[2], SqlParserError<string>>>

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
	Extends<
		T4Table,
		{
			kind: "table"
			columns: { at: string }
			column_sql_types: { at: "timestamp with time zone" }
		}
	>
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
	Extends<
		TExplicitTable,
		{
			kind: "table"
			columns: { amount: string; note: string }
			column_sql_types: { amount: "numeric"; note: "text" }
		}
	>
>

type TExplicitIfNot = ParseSqlStatement<
	ParseSqlTokens<`create table if not exists billing.credits ( id int not null );`>,
	DbBillingAndPublic
>
type TExplicitIfNotTable = TExplicitIfNot[1]["schemas"]["billing"]["sets"]["credits"]
type _tExplicitIfNotNull = Expect<Matches<TExplicitIfNot[2], null>>
type _tExplicitIfNotShape = Expect<
	Extends<
		TExplicitIfNotTable,
		{
			kind: "table"
			columns: { id: number }
			column_sql_types: { id: "int" }
		}
	>
>

type TExplicitUnknownSchema = ParseSqlStatement<
	ParseSqlTokens<`create table missing_schema.widgets ( id uuid not null );`>,
	DbBillingAndPublic
>
type _tExplicitUnknownSchema = Expect<Extends<TExplicitUnknownSchema[2], SqlParserError<string>>>

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
	Extends<
		T5Table,
		{
			kind: "table"
			columns: { id: string; title: string }
			column_sql_types: { id: "uuid"; title: "text" }
		}
	>
>

type T6 = ParseSqlStatement<
	ParseSqlTokens<`create table if not exists notifications ( id uuid not null, title text not null );`>,
	DbDefaultPublic
>
type T6Table = T6[1]["schemas"]["public"]["sets"]["notifications"]
type _t6null = Expect<Matches<T6[2], null>>
type _t6shape = Expect<
	Extends<
		T6Table,
		{
			kind: "table"
			columns: { id: string; title: string }
			column_sql_types: { id: "uuid"; title: "text" }
		}
	>
>

type TExpectedTableName = ParseSqlStatement<ParseSqlTokens<`create table( id int not null );`>, DbDefaultPublic>
type _expectedTableName = Expect<Extends<TExpectedTableName[2], SqlParserError<"Expected table name in CREATE TABLE">>>

type TDupWithoutIfNot = ParseSqlStatement<ParseSqlTokens<`create table auth.dup ( x int not null );`>, DbWithDup>
type _dupNoIfNot = Expect<Matches<TDupWithoutIfNot[2], SqlParserError<"Table already exists; use IF NOT EXISTS">>>

type TGarbageAfterClose = ParseSqlStatement<
	ParseSqlTokens<`create table n ( id int not null) extra ;`>,
	DbDefaultPublic
>
type _garbageAfterClose = Expect<Extends<TGarbageAfterClose[2], SqlParserError<"Expected `;` after CREATE TABLE">>>

type TUnknownQualifiedSchema = ParseSqlStatement<
	ParseSqlTokens<`create table zzz.ghost ( id int not null );`>,
	DbDefaultPublic
>
type _unknownQualifiedSchema = Expect<
	Extends<TUnknownQualifiedSchema[2], SqlParserError<"Unknown schema for CREATE TABLE">>
>

/** `defaultSchema` names where to create unqualified tables; that schema must exist (it is never implied). */
type DbDefaultPublicButOnlyAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type TUnqualifiedRequiresDefaultSchemaRow = ParseSqlStatement<
	ParseSqlTokens<`create table widgets ( id uuid not null );`>,
	DbDefaultPublicButOnlyAuth
>
type _unqMissingDefaultSchema = Expect<
	Extends<TUnqualifiedRequiresDefaultSchemaRow[2], SqlParserError<"Unknown schema for CREATE TABLE">>
>

type TQualifiedStillOkWhenDefaultMissing = ParseSqlStatement<
	ParseSqlTokens<`create table auth.widgets ( id uuid not null );`>,
	DbDefaultPublicButOnlyAuth
>
type TQualifiedWidgets = TQualifiedStillOkWhenDefaultMissing[1]["schemas"]["auth"]["sets"]["widgets"]
type _qualWhenDefaultMissingOk = Expect<Matches<TQualifiedStillOkWhenDefaultMissing[2], null>>
type _qualWhenDefaultMissingShape = Expect<
	Extends<
		TQualifiedWidgets,
		{ kind: "table"; columns: { id: string }; column_sql_types: { id: "uuid" } }
	>
>

type TMissingOpenParen = ParseSqlStatement<ParseSqlTokens<`create table t id int not null);`>, DbDefaultPublic>
type _missingOpenParen = Expect<Extends<TMissingOpenParen[2], SqlParserError<"Expected `.` or `(` after table name">>>

describe("parse-create-table (type tests)", () => {
	it("compile-time assertions above", () => {})
})
