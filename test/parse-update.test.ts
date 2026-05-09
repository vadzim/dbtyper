import { describe, it } from "node:test"
import type { JsqlUpdateStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TText } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText }
				}
			}
		}
	}
}

type UpOk = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where users.id = 'u';`>, DbUsers>
type _upOk = Expect<Extends<UpOk[2], JsqlUpdateStatementResult>>

type UpSetParam = ParseSqlStatement<ParseSqlTokens<`update users set name = :n where id = 'u';`>, DbUsers, { n: TText }>
type _upSetParam = Expect<Extends<UpSetParam[2], JsqlUpdateStatementResult>>

type UpBadSet = ParseSqlStatement<ParseSqlTokens<`update users set name = 1 where id = 'u';`>, DbUsers>
type _upBadSet = Expect<
	Extends<
		UpBadSet[2],
		DbtyperError<2507, `[dbt:INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN] Incompatible value type for column ${string}`>
	>
>

type UpBadWhere = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' where id = 1;`>, DbUsers>
type _upBadWhere = Expect<
	Extends<
		UpBadWhere[2],
		DbtyperError<2500, "[dbt:INCOMPATIBLE_TYPES_IN_COMPARISON] Incompatible types in comparison">
	>
>

type UpMultiOk = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'x', id = 'y' where users.id = 'u';`>,
	DbUsers
>
type _upMultiOk = Expect<Extends<UpMultiOk[2], JsqlUpdateStatementResult>>

type UpMultiBadSecond = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'x', id = 1 where users.id = 'u';`>,
	DbUsers
>
type _upMultiBadSecond = Expect<
	Extends<
		UpMultiBadSecond[2],
		DbtyperError<2507, `[dbt:INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN] Incompatible value type for column ${string}`>
	>
>

type DbAppDefaultPublicUsers = {
	defaultSchema: "app"
	schemas: {
		app: { sets: unknown }
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText }
				}
			}
		}
	}
}

type UpMultiQualified = ParseSqlStatement<
	ParseSqlTokens<`update public.users set name = 'x', id = 'y' where public.users.id = 'u';`>,
	DbAppDefaultPublicUsers
>
type _upMultiQualified = Expect<Extends<UpMultiQualified[2], JsqlUpdateStatementResult>>

type UpReturning = ParseSqlStatement<ParseSqlTokens<`update users set name = 'x' returning id;`>, DbUsers>
type _upReturning = Expect<Extends<UpReturning[2], { kind: "select"; columns: { id: TText } }>>

type UpWithoutWhereReturning = ParseSqlStatement<
	ParseSqlTokens<`update users set name = 'Everyone' returning *;`>,
	DbUsers
>
type _upWithoutWhereReturning = Expect<
	Extends<UpWithoutWhereReturning[2], { kind: "select"; columns: { id: TText; name: TText } }>
>

describe("parse-update (type tests)", () => {
	it("compile-time assertions above", () => {})
})
