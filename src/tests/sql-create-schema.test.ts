import type { SqlStatement } from "../parser/sql-parse-statement.js"
import { describe, it } from "node:test"
import type { Expect, ExpectFalse, Matches } from "../test-utils/type-test-utils.js"

type CreateAuth = SqlStatement<`create schema auth`>
type _CreateAuth = Expect<
	Matches<
		CreateAuth,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: false
		}
	>
>

type CreateAuthIfNotExists = SqlStatement<`create schema if not exists auth`>
type _CreateAuthIfNotExists = Expect<
	Matches<
		CreateAuthIfNotExists,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: true
		}
	>
>

type CreateAuthSemicolon = SqlStatement<`create schema auth;`>
type _CreateAuthSemicolon = Expect<
	Matches<
		CreateAuthSemicolon,
		{
			readonly kind: "create_schema"
			readonly name: "auth"
			readonly ifNotExists: false
		}
	>
>

type CreateQuoted = SqlStatement<`create schema "my schema"`>
type _CreateQuoted = Expect<
	Matches<
		CreateQuoted,
		{
			readonly kind: "create_schema"
			readonly name: "my schema"
			readonly ifNotExists: false
		}
	>
>

type BadStatement = SqlStatement<`create view v as select 1`>
type _BadStatement = ExpectFalse<Matches<BadStatement, { readonly kind: "create_schema" }>>

describe("sql create schema", () => {
	it("should run", () => {})
})
