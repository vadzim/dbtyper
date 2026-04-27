import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseCreateSchema } from "../src/parser/parse-create-schema.ts"

type EmptyDb = {
	defaultSchema: "public"
	schemas: {}
}

type DbWithAuth = {
	defaultSchema: "public"
	schemas: { auth: JsqlSchemaShape }
}

type NewSchema = ParseCreateSchema<ParseSqlTokens<"bar;">, EmptyDb>
type _newAddsSchema = Expect<Matches<NewSchema[2], null>>
type _newDbHasBar = Expect<Matches<NewSchema[1]["schemas"]["bar"], JsqlSchemaShape>>

type DupSchema = ParseCreateSchema<ParseSqlTokens<"auth;">, DbWithAuth>
type _dupIsError = Expect<
	Matches<DupSchema[2], SqlParserError<"Schema already exists; use IF NOT EXISTS">>
>
type _dupDbUnchanged = Expect<Matches<DupSchema[1], DbWithAuth>>

type IfNotDup = ParseCreateSchema<ParseSqlTokens<"if not exists auth;">, DbWithAuth>
type _ifNotDupNoop = Expect<Matches<IfNotDup[2], null>>
type _ifNotDupDb = Expect<Matches<IfNotDup[1], DbWithAuth>>

type IfNotNew = ParseCreateSchema<ParseSqlTokens<"if not exists other;">, EmptyDb>
type _ifNotNewAdds = Expect<Matches<IfNotNew[2], null>>
type _ifNotNewHasOther = Expect<Matches<IfNotNew[1]["schemas"]["other"], JsqlSchemaShape>>

describe("parse-create-schema (type tests)", () => {
	it("compile-time assertions above", () => {})
})
