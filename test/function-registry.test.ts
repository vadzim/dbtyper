import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { InferSqlErrors } from "../src/core/sql-query.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"

/** Minimal catalog with typed custom SQL functions (`functions`). */
type DbFns = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				t: { kind: "table"; columns: { x: number }; column_sql_types: { x: "integer" } }
			}
		}
	}
	scalarTypes: Record<string, unknown>
	functions: { custom_fn: number }
} & JsqlDatabaseShape

type InferOk = InferSqlErrors<DbFns, `select custom_fn(x) from t`>
type _inferOk = Expect<Extends<InferOk, null>>

type InferBadSel = InferSqlErrors<DbFns, `delete from t`>
type _inferNonSelect = Expect<Extends<InferBadSel, SqlParserError<string>>>

type TCustomFn = ParseSqlStatement<ParseSqlTokens<`select custom_fn(x) from t`>, DbFns>
type _customFn = Expect<Extends<Tuple3At2<TCustomFn>, { kind: "select"; columns: { "?column?": number } }>>

type TCountStar = ParseSqlStatement<ParseSqlTokens<`select count(*) from t`>, DbFns>
type _countStar = Expect<Extends<Tuple3At2<TCountStar>, { kind: "select"; columns: { "?column?": number } }>>

type TLower = ParseSqlStatement<ParseSqlTokens<`select lower('a') from t`>, DbFns>
type _lower = Expect<Extends<Tuple3At2<TLower>, { kind: "select"; columns: { "?column?": string } }>>

describe("function registry (type tests)", () => {
	it("compile-time assertions above", () => {})
})
