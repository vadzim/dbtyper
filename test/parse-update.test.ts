import { describe, it } from "node:test"
import type { JsqlUpdateStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { PackageScalarTypes } from "./test-utils/package-scalar-types.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: "text"; name: "text" }
				}
			}
		}
	}
	scalarTypes: PackageScalarTypes
}

type UpOk = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where users.id = 'u';`>, DbUsers>
type _upOk = Expect<Extends<Tuple3At2<UpOk>, JsqlUpdateStatementResult>>

type UpSetParam = ParseSqlStatement<
	ParseSqlTokens<`update users set name = :n where id = 'u';`>,
	DbUsers,
	{ n: { ts: string; sql: "text" } }
>
type _upSetParam = Expect<Extends<Tuple3At2<UpSetParam>, JsqlUpdateStatementResult>>

type UpBadSet = ParseSqlStatement<ParseSqlTokens<`update users set name = 1 where id = 'u';`>, DbUsers>
type _upBadSet = Expect<Extends<Tuple3At2<UpBadSet>, SqlParserError<"Incompatible value type for column">>>

type UpBadWhere = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where id = 1;`>, DbUsers>
type _upBadWhere = Expect<Extends<Tuple3At2<UpBadWhere>, SqlParserError<"Incompatible types in comparison">>>

type UpMultiOk = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'x', id = 'y' where users.id = 'u';`>,
	DbUsers
>
type _upMultiOk = Expect<Extends<Tuple3At2<UpMultiOk>, JsqlUpdateStatementResult>>

type UpMultiBadSecond = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'x', id = 1 where users.id = 'u';`>,
	DbUsers
>
type _upMultiBadSecond = Expect<
	Extends<Tuple3At2<UpMultiBadSecond>, SqlParserError<"Incompatible value type for column">>
>

type DbAppDefaultPublicUsers = {
	defaultSchema: "app"
	schemas: {
		app: { sets: {} }
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: "text"; name: "text" }
				}
			}
		}
	}
	scalarTypes: PackageScalarTypes
}

type UpMultiQualified = ParseSqlStatement<
	ParseSqlTokens<`update public.users set name = 'x', id = 'y' where public.users.id = 'u';`>,
	DbAppDefaultPublicUsers
>
type _upMultiQualified = Expect<Extends<Tuple3At2<UpMultiQualified>, JsqlUpdateStatementResult>>

type UpReturning = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' returning id;`>, DbUsers>
type _upReturning = Expect<Extends<Tuple3At2<UpReturning>, { kind: "select"; columns: { id: "text" } }>>

type UpWithoutWhereReturning = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'Everyone' returning *;`>,
	DbUsers
>
type _upWithoutWhereReturning = Expect<
	Extends<Tuple3At2<UpWithoutWhereReturning>, { kind: "select"; columns: { id: "text"; name: "text" } }>
>

describe("parse-update (type tests)", () => {
	it("compile-time assertions above", () => {})
})
