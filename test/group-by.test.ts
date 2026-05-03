import { describe, it } from "node:test"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbGroup = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { region: string; amount: number }
					column_sql_types: { region: "text"; amount: "numeric" }
				}
			}
		}
	}
	scalarTypes: Record<string, unknown>
} & JsqlDatabaseShape

type TGroupBy = ParseSqlStatement<ParseSqlTokens<`select region from sales group by region;`>, DbGroup>

type _groupByOk = Expect<Extends<Tuple3At2<TGroupBy>, JsqlSelectStatementResult>>

type THaving = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region having region = 'eu';`>,
	DbGroup
>

type _havingOk = Expect<Extends<Tuple3At2<THaving>, JsqlSelectStatementResult>>

type THavingBad = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region having not_a_col = 'x';`>,
	DbGroup
>

type _havingBad = Expect<Extends<Tuple3At2<THavingBad>, SqlParserError<string>>>

describe("GROUP BY / HAVING (type tests)", () => {
	it("compile-time assertions above", () => {})
})
