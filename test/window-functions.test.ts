import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbWindow = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { id: "integer"; product: "text"; amount: "integer"; sale_date: "text" }
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
	Extends<Tuple3At2<TRowNumber>, { kind: "select"; columns: { id: "integer"; product: "text"; row_num: "bigint" } }>
>

// Test ROW_NUMBER() with ORDER BY DESC
type TRowNumberDesc = ParseSqlStatement<
	ParseSqlTokens<`select id, product, row_number() over (order by amount desc) as row_num from sales;`>,
	DbWindow
>
type _tRowNumberDesc = Expect<
	Extends<
		Tuple3At2<TRowNumberDesc>,
		{ kind: "select"; columns: { id: "integer"; product: "text"; row_num: "bigint" } }
	>
>

// Test RANK() with ORDER BY
type TRank = ParseSqlStatement<
	ParseSqlTokens<`select id, product, rank() over (order by amount) as rank_num from sales;`>,
	DbWindow
>
type _tRank = Expect<
	Extends<Tuple3At2<TRank>, { kind: "select"; columns: { id: "integer"; product: "text"; rank_num: "bigint" } }>
>

// Test DENSE_RANK() with ORDER BY
type TDenseRank = ParseSqlStatement<
	ParseSqlTokens<`select id, product, dense_rank() over (order by amount) as dense_rank_num from sales;`>,
	DbWindow
>
type _tDenseRank = Expect<
	Extends<
		Tuple3At2<TDenseRank>,
		{ kind: "select"; columns: { id: "integer"; product: "text"; dense_rank_num: "bigint" } }
	>
>

// Test multiple window functions
type TMultipleWindow = ParseSqlStatement<
	ParseSqlTokens<`select id, row_number() over (order by amount) as row_num, rank() over (order by amount) as rank_num from sales;`>,
	DbWindow
>
type _tMultipleWindow = Expect<
	Extends<
		Tuple3At2<TMultipleWindow>,
		{ kind: "select"; columns: { id: "integer"; row_num: "bigint"; rank_num: "bigint" } }
	>
>

// Test ROW_NUMBER() with PARTITION BY
type TPartitionBy = ParseSqlStatement<
	ParseSqlTokens<`select id, product, row_number() over (partition by product order by amount) as row_num from sales;`>,
	DbWindow
>
type _tPartitionBy = Expect<
	Extends<Tuple3At2<TPartitionBy>, { kind: "select"; columns: { id: "integer"; product: "text"; row_num: "bigint" } }>
>

// Test RANK() with PARTITION BY and multiple ORDER BY
type TPartitionByMultiOrder = ParseSqlStatement<
	ParseSqlTokens<`select id, rank() over (partition by product order by amount desc, sale_date) as rank_num from sales;`>,
	DbWindow
>
type _tPartitionByMultiOrder = Expect<
	Extends<Tuple3At2<TPartitionByMultiOrder>, { kind: "select"; columns: { id: "integer"; rank_num: "bigint" } }>
>

// Test multiple PARTITION BY columns
type TMultiPartition = ParseSqlStatement<
	ParseSqlTokens<`select id, row_number() over (partition by product, sale_date order by amount) as row_num from sales;`>,
	DbWindow
>
type _tMultiPartition = Expect<
	Extends<Tuple3At2<TMultiPartition>, { kind: "select"; columns: { id: "integer"; row_num: "bigint" } }>
>

// Test LAG() with PARTITION BY and ORDER BY
type TLag = ParseSqlStatement<
	ParseSqlTokens<`select id, product, amount, lag(amount) over (partition by product order by sale_date) as prev_amount from sales;`>,
	DbWindow
>
type _tLag = Expect<Extends<Tuple3At2<TLag>, { kind: "select" }>>

// Test LEAD() with PARTITION BY and ORDER BY
type TLead = ParseSqlStatement<
	ParseSqlTokens<`select id, product, amount, lead(amount) over (partition by product order by sale_date) as next_amount from sales;`>,
	DbWindow
>
type _tLead = Expect<Extends<Tuple3At2<TLead>, { kind: "select" }>>

// Test LAG() with offset
type TLagOffset = ParseSqlStatement<
	ParseSqlTokens<`select id, lag(amount, 2) over (order by sale_date) as prev_amount from sales;`>,
	DbWindow
>
type _tLagOffset = Expect<Extends<Tuple3At2<TLagOffset>, { kind: "select" }>>

// Test LEAD() with offset and default
type TLeadDefault = ParseSqlStatement<
	ParseSqlTokens<`select id, lead(amount, 1, 0) over (order by sale_date) as next_amount from sales;`>,
	DbWindow
>
type _tLeadDefault = Expect<Extends<Tuple3At2<TLeadDefault>, { kind: "select" }>>

describe("window-functions (type tests)", () => {
	it("compile-time assertions above", () => {})
})
