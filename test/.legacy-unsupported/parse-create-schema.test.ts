import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../../src/core/jsql-shapes.ts"
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import type { DbtyperError } from "../../src/dbtyper-error.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"

type EmptyDb = {
	defaultSchema: "public"
	schemas: unknown
}

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type NewSchema = ParseSqlStatement<CreateParserMonad<"create schema bar;">, EmptyDb>
expectType<NewSchema[2]>(toBe<null>())
type _newDbHasBar = Expect<Matches<NewSchema[1], { schemas: Record<"bar", JsqlSchemaShape> }>>

type IfNotDup = ParseSqlStatement<CreateParserMonad<"create schema if not exists auth;">, DbWithAuth>
expectType<IfNotDup[2]>(toBe<null>())
expectType<IfNotDup[1]>(toBe<DbWithAuth>())

type IfNotNew = ParseSqlStatement<CreateParserMonad<"create schema if not exists other;">, EmptyDb>
expectType<IfNotNew[2]>(toBe<null>())
type _ifNotNewHasOther = Expect<Matches<IfNotNew[1], { schemas: Record<"other", JsqlSchemaShape> }>>

type TIfExistsWrong = ParseSqlStatement<CreateParserMonad<"create schema if exists should_fail;">, EmptyDb>
type _ifExistsWrong = Expect<
	Matches<TIfExistsWrong[2], DbtyperError<3702, "Expected `not` after `IF` in CREATE SCHEMA">>
>

type TSchemaMissingSemi = ParseSqlStatement<CreateParserMonad<"create schema almost_schema trailing;">, EmptyDb>
type _schemaMissingSemi = Expect<
	Matches<TSchemaMissingSemi[2], DbtyperError<1105, "Expected semicolon after schema name in CREATE SCHEMA">>
>

type TSchemaMissingName = ParseSqlStatement<CreateParserMonad<"create schema ;">, EmptyDb>
type _schemaMissingName = Expect<
	Matches<TSchemaMissingName[2], DbtyperError<3700, "Expected schema name in CREATE SCHEMA">>
>

describe("parse-create-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
