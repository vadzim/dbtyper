import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"

import { expectType, toBe } from "./test-utils/type-test-utils.ts"
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

type D1 = ParseSqlStatement<CreateParserMonad<`drop schema auth;`>, DbWithAuth>
expectType<D1[2]>(toBe<null>())
expectType<D1[1]>(toBe<DbAuthDropped>())

type D1IfExists = ParseSqlStatement<CreateParserMonad<`drop schema if exists auth;`>, DbWithAuth>
expectType<D1IfExists[2]>(toBe<null>())
expectType<D1IfExists[1]>(toBe<DbAuthDropped>())

type D2 = ParseSqlStatement<CreateParserMonad<`drop schema if exists ghost;`>, DbWithAuth>
expectType<D2[2]>(toBe<null>())
expectType<D2[1]>(toBe<DbWithAuth>())

type D4 = ParseSqlStatement<CreateParserMonad<`drop schema auth;`>, DbMulti>
expectType<D4[1]>(toBe<DbMultiDroppedAuth>())

describe("parse-drop-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
