import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TBigint,
	TBoolean,
	TNumeric,
	TUuid,
	TTimestamp,
	TDate,
} from "./test-utils/sql-type-helpers.ts"

type DbWindow = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { id: TInteger; product: TText; amount: TInteger; sale_date: TText }
				}
			}
		}
	}
}

// Test ROW_NUMBER() with ORDER BY
type TRowNumber = ParseSqlStatement<
	ParseSqlTokens<`select id, product, row_number() over (order by amount) as row_num from sales;`>,
	DbWindow
>
type _tRowNumber = Expect<
	Extends<TRowNumber[2], { kind: "select"; columns: { id: TInteger; product: TText; row_num: TBigint } }>
>

// Test ROW_NUMBER() with ORDER BY DESC
type TRowNumberDesc = ParseSqlStatement<
	ParseSqlTokens<`select id, product, row_number() over (order by amount desc) as row_num from sales;`>,
	DbWindow
>
type _tRowNumberDesc = Expect<
	Extends<TRowNumberDesc[2], { kind: "select"; columns: { id: TInteger; product: TText; row_num: TBigint } }>
>

// Test RANK() with ORDER BY
type TRank = ParseSqlStatement<
	ParseSqlTokens<`select id, product, rank() over (order by amount) as rank_num from sales;`>,
	DbWindow
>
type _tRank = Expect<
	Extends<TRank[2], { kind: "select"; columns: { id: TInteger; product: TText; rank_num: TBigint } }>
>

// Test DENSE_RANK() with ORDER BY
type TDenseRank = ParseSqlStatement<
	ParseSqlTokens<`select id, product, dense_rank() over (order by amount) as dense_rank_num from sales;`>,
	DbWindow
>
type _tDenseRank = Expect<
	Extends<TDenseRank[2], { kind: "select"; columns: { id: TInteger; product: TText; dense_rank_num: TBigint } }>
>

// Test multiple window functions
type TMultipleWindow = ParseSqlStatement<
	ParseSqlTokens<`select id, row_number() over (order by amount) as row_num, rank() over (order by amount) as rank_num from sales;`>,
	DbWindow
>
type _tMultipleWindow = Expect<
	Extends<TMultipleWindow[2], { kind: "select"; columns: { id: TInteger; row_num: TBigint; rank_num: TBigint } }>
>

// Test ROW_NUMBER() with PARTITION BY
type TPartitionBy = ParseSqlStatement<
	ParseSqlTokens<`select id, product, row_number() over (partition by product order by amount) as row_num from sales;`>,
	DbWindow
>
type _tPartitionBy = Expect<
	Extends<TPartitionBy[2], { kind: "select"; columns: { id: TInteger; product: TText; row_num: TBigint } }>
>

// Test RANK() with PARTITION BY and multiple ORDER BY
type TPartitionByMultiOrder = ParseSqlStatement<
	ParseSqlTokens<`select id, rank() over (partition by product order by amount desc, sale_date) as rank_num from sales;`>,
	DbWindow
>
type _tPartitionByMultiOrder = Expect<
	Extends<TPartitionByMultiOrder[2], { kind: "select"; columns: { id: TInteger; rank_num: TBigint } }>
>

// Test multiple PARTITION BY columns
type TMultiPartition = ParseSqlStatement<
	ParseSqlTokens<`select id, row_number() over (partition by product, sale_date order by amount) as row_num from sales;`>,
	DbWindow
>
type _tMultiPartition = Expect<
	Extends<TMultiPartition[2], { kind: "select"; columns: { id: TInteger; row_num: TBigint } }>
>

// Test LAG() with PARTITION BY and ORDER BY
type TLag = ParseSqlStatement<
	ParseSqlTokens<`select id, product, amount, lag(amount) over (partition by product order by sale_date) as prev_amount from sales;`>,
	DbWindow
>
type _tLag = Expect<Extends<TLag[2], { kind: "select" }>>

// Test LEAD() with PARTITION BY and ORDER BY
type TLead = ParseSqlStatement<
	ParseSqlTokens<`select id, product, amount, lead(amount) over (partition by product order by sale_date) as next_amount from sales;`>,
	DbWindow
>
type _tLead = Expect<Extends<TLead[2], { kind: "select" }>>

// Test LAG() with offset
type TLagOffset = ParseSqlStatement<
	ParseSqlTokens<`select id, lag(amount, 2) over (order by sale_date) as prev_amount from sales;`>,
	DbWindow
>
type _tLagOffset = Expect<Extends<TLagOffset[2], { kind: "select" }>>

// Test LEAD() with offset and default
type TLeadDefault = ParseSqlStatement<
	ParseSqlTokens<`select id, lead(amount, 1, 0) over (order by sale_date) as next_amount from sales;`>,
	DbWindow
>
type _tLeadDefault = Expect<Extends<TLeadDefault[2], { kind: "select" }>>

describe("window-functions (type tests)", () => {
	it("compile-time assertions above", () => {})
})
