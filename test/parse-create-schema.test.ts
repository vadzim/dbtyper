import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { PackageScalarTypes } from "./test-utils/parser-test-utils.ts"

type EmptyDb = {
	defaultSchema: "public"
	schemas: {}
	scalarTypes: PackageScalarTypes
}

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
	scalarTypes: PackageScalarTypes
}

type NewSchema = ParseSqlStatement<ParseSqlTokens<"create schema bar;">, EmptyDb>
type _newAddsSchema = Expect<Matches<NewSchema[2], null>>
type _newDbHasBar = Expect<Matches<NewSchema[1]["schemas"]["bar"], JsqlSchemaShape>>

type DupSchema = ParseSqlStatement<ParseSqlTokens<"create schema auth;">, DbWithAuth>
type _dupIsError = Expect<Matches<DupSchema[2], SqlParserError<"Schema already exists; use IF NOT EXISTS">>>
type _dupDbUnchanged = Expect<Matches<DupSchema[1], DbWithAuth>>

type IfNotDup = ParseSqlStatement<ParseSqlTokens<"create schema if not exists auth;">, DbWithAuth>
type _ifNotDupNoop = Expect<Matches<IfNotDup[2], null>>
type _ifNotDupDb = Expect<Matches<IfNotDup[1], DbWithAuth>>

type IfNotNew = ParseSqlStatement<ParseSqlTokens<"create schema if not exists other;">, EmptyDb>
type _ifNotNewAdds = Expect<Matches<IfNotNew[2], null>>
type _ifNotNewHasOther = Expect<Matches<IfNotNew[1]["schemas"]["other"], JsqlSchemaShape>>

type TIfExistsWrong = ParseSqlStatement<ParseSqlTokens<"create schema if exists should_fail;">, EmptyDb>
type _ifExistsWrong = Expect<Extends<TIfExistsWrong[2], SqlParserError<"Expected `not` after `IF` in CREATE SCHEMA">>>

type TSchemaMissingSemi = ParseSqlStatement<ParseSqlTokens<"create schema almost_schema trailing;">, EmptyDb>
type _schemaMissingSemi = Expect<
	Extends<TSchemaMissingSemi[2], SqlParserError<"Expected `;` after schema name in CREATE SCHEMA">>
>

type TSchemaMissingName = ParseSqlStatement<ParseSqlTokens<"create schema ;">, EmptyDb>
type _schemaMissingName = Expect<
	Extends<TSchemaMissingName[2], SqlParserError<"Expected schema name in CREATE SCHEMA">>
>

describe("parse-create-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
