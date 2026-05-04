import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { PackageScalarTypes } from "./test-utils/parser-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
	scalarTypes: PackageScalarTypes
}

type DbAuthDropped = {
	defaultSchema: "public"
	schemas: Omit<DbWithAuth["schemas"], "auth">
	scalarTypes: PackageScalarTypes
}

type DbMulti = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape; logs: JsqlSchemaShape }
	scalarTypes: PackageScalarTypes
}

type DbMultiDroppedAuth = {
	defaultSchema: "public"
	schemas: Omit<DbMulti["schemas"], "auth">
	scalarTypes: PackageScalarTypes
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

type D3 = ParseSqlStatement<ParseSqlTokens<`drop schema ghost;`>, DbWithAuth>
type _d3err = Expect<Matches<D3[2], SqlParserError<"Schema does not exist; use IF EXISTS">>>

type D4 = ParseSqlStatement<ParseSqlTokens<`drop schema auth;`>, DbMulti>
type _d4shape = Expect<Matches<D4[1], DbMultiDroppedAuth>>

type DMissingSemi = ParseSqlStatement<ParseSqlTokens<`drop schema auth trailing`>, DbWithAuth>
type _dMissingSemi = Expect<Extends<DMissingSemi[2], SqlParserError<"Expected `;` after DROP SCHEMA">>>

type DMissingName = ParseSqlStatement<ParseSqlTokens<`drop schema ;`>, DbWithAuth>
type _dMissingName = Expect<Extends<DMissingName[2], SqlParserError<"Expected schema name in DROP SCHEMA">>>

type DIfWrong = ParseSqlStatement<ParseSqlTokens<`drop schema if not exists auth;`>, DbWithAuth>
type _dIfWrong = Expect<Extends<DIfWrong[2], SqlParserError<"Expected `exists` after `IF` in DROP SCHEMA">>>

describe("parse-drop-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
