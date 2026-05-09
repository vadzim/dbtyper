import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type EmptyDb = {
	defaultSchema: "public"
	schemas: unknown
}

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type NewSchema = ParseSqlStatement<ParseSqlTokens<"create schema bar;">, EmptyDb>
type _newAddsSchema = Expect<Matches<NewSchema[2], null>>
type _newDbHasBar = Expect<Extends<NewSchema[1], { schemas: Record<"bar", JsqlSchemaShape> }>>

type IfNotDup = ParseSqlStatement<ParseSqlTokens<"create schema if not exists auth;">, DbWithAuth>
type _ifNotDupNoop = Expect<Matches<IfNotDup[2], null>>
type _ifNotDupDb = Expect<Matches<IfNotDup[1], DbWithAuth>>

type IfNotNew = ParseSqlStatement<ParseSqlTokens<"create schema if not exists other;">, EmptyDb>
type _ifNotNewAdds = Expect<Matches<IfNotNew[2], null>>
type _ifNotNewHasOther = Expect<Extends<IfNotNew[1], { schemas: Record<"other", JsqlSchemaShape> }>>

type TIfExistsWrong = ParseSqlStatement<ParseSqlTokens<"create schema if exists should_fail;">, EmptyDb>
type _ifExistsWrong = Expect<
	Extends<TIfExistsWrong[2], DbtyperError<3702, "Expected `not` after `IF` in CREATE SCHEMA">>
>

type TSchemaMissingSemi = ParseSqlStatement<ParseSqlTokens<"create schema almost_schema trailing;">, EmptyDb>
type _schemaMissingSemi = Expect<
	Extends<TSchemaMissingSemi[2], DbtyperError<3701, "Expected `;` after schema name in CREATE SCHEMA">>
>

type TSchemaMissingName = ParseSqlStatement<ParseSqlTokens<"create schema ;">, EmptyDb>
type _schemaMissingName = Expect<
	Extends<TSchemaMissingName[2], DbtyperError<3700, "Expected schema name in CREATE SCHEMA">>
>

describe("parse-create-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
