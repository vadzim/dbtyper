import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { DbtyperError as _DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends as _Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type DbAuthDropped = {
	defaultSchema: "public"
	schemas: Omit<DbWithAuth["schemas"], "auth">
}

type DbMulti = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape; logs: JsqlSchemaShape }
}

type DbMultiDroppedAuth = {
	defaultSchema: "public"
	schemas: Omit<DbMulti["schemas"], "auth">
}

type D1 = ParseSqlStatement<ParseSqlTokens<`drop schema auth;`>, DbWithAuth>
type _d1null = Expect<Matches<D1[2], null>>
type _d1shape = Expect<Matches<D1[1], DbAuthDropped>>

type D1IfExists = ParseSqlStatement<ParseSqlTokens<`drop schema if exists auth;`>, DbWithAuth>
type _d1IfExistsNull = Expect<Matches<D1IfExists[2], null>>
type _d1IfExistsShape = Expect<Matches<D1IfExists[1], DbAuthDropped>>

type D2 = ParseSqlStatement<ParseSqlTokens<`drop schema if exists ghost;`>, DbWithAuth>
type _d2null = Expect<Matches<D2[2], null>>
type _d2db = Expect<Matches<D2[1], DbWithAuth>>

type D4 = ParseSqlStatement<ParseSqlTokens<`drop schema auth;`>, DbMulti>
type _d4shape = Expect<Matches<D4[1], DbMultiDroppedAuth>>

describe("parse-drop-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
