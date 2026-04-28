import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type DbAuthDropped = {
	defaultSchema: "public"
	schemas: Omit<DbWithAuth["schemas"], "auth">
}

type D1 = ParseSqlStatement<ParseSqlTokens<`drop schema auth;`>, DbWithAuth>
type _d1null = Expect<Matches<D1[2], null>>
type _d1shape = Expect<Matches<D1[1], DbAuthDropped>>

type D1IfExists = ParseSqlStatement<ParseSqlTokens<`drop schema if exists auth;`>, DbWithAuth>
type _d1IfExistsNull = Expect<Matches<D1IfExists[2], null>>
type _d1IfExistsShape = Expect<Matches<D1IfExists[1], DbAuthDropped>>

type D2 = ParseSqlStatement<ParseSqlTokens<`drop schema if exists ghost;`>, DbWithAuth>
type _d2null = Expect<Matches<D2[2], null>>
type _d2db = Expect<DbWithAuth extends D2[1] ? (D2[1] extends DbWithAuth ? true : false) : false>

type D3 = ParseSqlStatement<ParseSqlTokens<`drop schema ghost;`>, DbWithAuth>
type _d3err = Expect<Matches<D3[2], SqlParserError<"Schema does not exist; use IF EXISTS">>>

type DbMulti = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape; logs: JsqlSchemaShape }
}

type DbMultiDroppedAuth = {
	defaultSchema: "public"
	schemas: Omit<DbMulti["schemas"], "auth">
}

type D4 = ParseSqlStatement<ParseSqlTokens<`drop schema auth;`>, DbMulti>
type _d4shape = Expect<Matches<D4[1], DbMultiDroppedAuth>>

type DMissingSemi = ParseSqlStatement<ParseSqlTokens<`drop schema auth trailing`>, DbWithAuth>
type _dMissingSemi = Expect<DMissingSemi[2] extends SqlParserError<"Expected `;` after DROP SCHEMA"> ? true : false>

type DMissingName = ParseSqlStatement<ParseSqlTokens<`drop schema ;`>, DbWithAuth>
type _dMissingName = Expect<
	DMissingName[2] extends SqlParserError<"Expected schema name in DROP SCHEMA"> ? true : false
>

type DIfWrong = ParseSqlStatement<ParseSqlTokens<`drop schema if not exists auth;`>, DbWithAuth>
type _dIfWrong = Expect<
	DIfWrong[2] extends SqlParserError<"Expected `exists` after `IF` in DROP SCHEMA"> ? true : false
>

describe("parse-drop-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
