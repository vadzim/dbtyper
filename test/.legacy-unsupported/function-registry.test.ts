import { describe, it } from "node:test"
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import type { TText, TInteger, TBigint, TNumeric, TUuid, TTimestamp } from "../test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"
import type { ExtractStreamError } from "../test-utils/error-test-utils.ts"

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
type _inferOk = Expect<Matches<InferOk, null>>

type TCustomFn = ParseSqlStatement<CreateParserMonad<`select custom_fn(x) from t`>, DbFns>
type _customFn = Expect<Matches<TCustomFn[2], { kind: "select"; returning: { "?column?": TInteger } }>>
type TCountStar = ParseSqlStatement<CreateParserMonad<`select count(*) from t`>, DbFns>
type _countStar = Expect<Matches<TCountStar[2], { kind: "select"; returning: { "?column?": TBigint } }>>
type TCountOne = ParseSqlStatement<CreateParserMonad<`select count(1) from t`>, DbFns>
type _countOne = Expect<Matches<TCountOne[2], { kind: "select"; returning: { "?column?": TBigint } }>>
type TUuidV4 = ParseSqlStatement<CreateParserMonad<`select uuid_generate_v4() from t`>, DbFns>
type _uuidV4 = Expect<Matches<TUuidV4[2], { kind: "select"; returning: { "?column?": TUuid } }>>
type TLower = ParseSqlStatement<CreateParserMonad<`select lower('a') from t`>, DbFns>
type _lower = Expect<Matches<TLower[2], { kind: "select"; returning: { "?column?": TText } }>>
/** `coalesce` picks first argument type. */
type TCoalesce = ParseSqlStatement<CreateParserMonad<`select coalesce(x, x) from t`>, DbFns>
type _coalesce = Expect<Matches<TCoalesce[2], { kind: "select"; returning: { "?column?": TInteger } }>>

type TSum = ParseSqlStatement<CreateParserMonad<`select sum(x) from t`>, DbFns>
type _sum = Expect<Matches<TSum[2], { kind: "select"; returning: { "?column?": TNumeric } }>>

type TNow = ParseSqlStatement<CreateParserMonad<`select now() from t`>, DbFns>
type _now = Expect<Matches<TNow[2], { kind: "select"; returning: { "?column?": TTimestamp } }>>
type TGenRandomUuid = ParseSqlStatement<CreateParserMonad<`select gen_random_uuid() from t`>, DbFns>
type _uuid = Expect<Matches<TGenRandomUuid[2], { kind: "select"; returning: { "?column?": TUuid } }>>

type TUpperNum = ParseSqlStatement<CreateParserMonad<`select upper(1) from t`>, DbFns>
type _upperNum = Expect<Matches<TUpperNum[2], { kind: "select"; returning: { "?column?": TText } }>>
type TUpper = ParseSqlStatement<CreateParserMonad<`select upper('x') from t`>, DbFns>
type _upper = Expect<Matches<TUpper[2], { kind: "select"; returning: { "?column?": TText } }>>
describe("function registry (type tests)", () => {
	it("compile-time assertions above", () => {})
})
