import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TText, TInteger, TBigint, TNumeric, TUuid, TTimestamp } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ExtractStreamError } from "./test-utils/error-test-utils.ts"

/** Minimal catalog with typed custom SQL functions (`functions`). */
type DbFns = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				t: { kind: "table"; columns: { x: TInteger } }
			}
		}
	}
	functions: { custom_fn: TInteger }
}
type InferOk = ExtractStreamError<DbFns, `select custom_fn(x) from t`>
type _inferOk = Expect<Extends<InferOk, null>>

type TCustomFn = ParseSqlStatement<ParseSqlTokens<`select custom_fn(x) from t`>, DbFns>
type _customFn = Expect<Extends<TCustomFn[2], { kind: "select"; columns: { "?column?": TInteger } }>>
type TCountStar = ParseSqlStatement<ParseSqlTokens<`select count(*) from t`>, DbFns>
type _countStar = Expect<Extends<TCountStar[2], { kind: "select"; columns: { "?column?": TBigint } }>>
type TCountOne = ParseSqlStatement<ParseSqlTokens<`select count(1) from t`>, DbFns>
type _countOne = Expect<Extends<TCountOne[2], { kind: "select"; columns: { "?column?": TBigint } }>>
type TUuidV4 = ParseSqlStatement<ParseSqlTokens<`select uuid_generate_v4() from t`>, DbFns>
type _uuidV4 = Expect<Extends<TUuidV4[2], { kind: "select"; columns: { "?column?": TUuid } }>>
type TLower = ParseSqlStatement<ParseSqlTokens<`select lower('a') from t`>, DbFns>
type _lower = Expect<Extends<TLower[2], { kind: "select"; columns: { "?column?": TText } }>>
/** `coalesce` picks first argument type. */
type TCoalesce = ParseSqlStatement<ParseSqlTokens<`select coalesce(x, x) from t`>, DbFns>
type _coalesce = Expect<Extends<TCoalesce[2], { kind: "select"; columns: { "?column?": TInteger } }>>

type TSum = ParseSqlStatement<ParseSqlTokens<`select sum(x) from t`>, DbFns>
type _sum = Expect<Extends<TSum[2], { kind: "select"; columns: { "?column?": TNumeric } }>>

type TNow = ParseSqlStatement<ParseSqlTokens<`select now() from t`>, DbFns>
type _now = Expect<Extends<TNow[2], { kind: "select"; columns: { "?column?": TTimestamp } }>>
type TGenRandomUuid = ParseSqlStatement<ParseSqlTokens<`select gen_random_uuid() from t`>, DbFns>
type _uuid = Expect<Extends<TGenRandomUuid[2], { kind: "select"; columns: { "?column?": TUuid } }>>

type TUpperNum = ParseSqlStatement<ParseSqlTokens<`select upper(1) from t`>, DbFns>
type _upperNum = Expect<Extends<TUpperNum[2], { kind: "select"; columns: { "?column?": TText } }>>
type TUpper = ParseSqlStatement<ParseSqlTokens<`select upper('x') from t`>, DbFns>
type _upper = Expect<Extends<TUpper[2], { kind: "select"; columns: { "?column?": TText } }>>
describe("function registry (type tests)", () => {
	it("compile-time assertions above", () => {})
})
