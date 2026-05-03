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

type TCountOne = ParseSqlStatement<ParseSqlTokens<`select count(1) from t`>, DbFns>
type _countOne = Expect<Extends<Tuple3At2<TCountOne>, { kind: "select"; columns: { "?column?": number } }>>

type TUuidV4 = ParseSqlStatement<ParseSqlTokens<`select uuid_generate_v4() from t`>, DbFns>
type _uuidV4 = Expect<Extends<Tuple3At2<TUuidV4>, { kind: "select"; columns: { "?column?": string } }>>

type TLower = ParseSqlStatement<ParseSqlTokens<`select lower('a') from t`>, DbFns>
type _lower = Expect<Extends<Tuple3At2<TLower>, { kind: "select"; columns: { "?column?": string } }>>

/** `coalesce` picks first argument type. */
type TCoalesce = ParseSqlStatement<ParseSqlTokens<`select coalesce(x, x) from t`>, DbFns>
type _coalesce = Expect<Extends<Tuple3At2<TCoalesce>, { kind: "select"; columns: { "?column?": number } }>>

type TCoalesceEmpty = ParseSqlStatement<ParseSqlTokens<`select coalesce() from t`>, DbFns>
type _coalesceEmpty = Expect<
	Extends<Tuple3At2<TCoalesceEmpty>, SqlParserError<"coalesce() requires at least one argument">>
>

type TSum = ParseSqlStatement<ParseSqlTokens<`select sum(x) from t`>, DbFns>
type _sum = Expect<Extends<Tuple3At2<TSum>, { kind: "select"; columns: { "?column?": number } }>>

type TSumEmpty = ParseSqlStatement<ParseSqlTokens<`select sum() from t`>, DbFns>
type _sumEmpty = Expect<Extends<Tuple3At2<TSumEmpty>, SqlParserError<"sum() requires an argument">>>

type TNow = ParseSqlStatement<ParseSqlTokens<`select now() from t`>, DbFns>
type _now = Expect<Extends<Tuple3At2<TNow>, { kind: "select"; columns: { "?column?": Date } }>>

type TUuid = ParseSqlStatement<ParseSqlTokens<`select gen_random_uuid() from t`>, DbFns>
type _uuid = Expect<Extends<Tuple3At2<TUuid>, { kind: "select"; columns: { "?column?": string } }>>

type TLowerBare = ParseSqlStatement<ParseSqlTokens<`select lower() from t`>, DbFns>
type _lowerBare = Expect<Extends<Tuple3At2<TLowerBare>, SqlParserError<"Function requires at least one argument">>>

type TUpperNum = ParseSqlStatement<ParseSqlTokens<`select upper(1) from t`>, DbFns>
type _upperNum = Expect<Extends<Tuple3At2<TUpperNum>, SqlParserError<"Function expects text argument">>>

type TUpper = ParseSqlStatement<ParseSqlTokens<`select upper('x') from t`>, DbFns>
type _upper = Expect<Extends<Tuple3At2<TUpper>, { kind: "select"; columns: { "?column?": string } }>>

describe("function registry (type tests)", () => {
	it("compile-time assertions above", () => {})
})
