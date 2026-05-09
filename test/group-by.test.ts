import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError, DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { TInteger, TText, TNumeric, TBigint } from "./test-utils/sql-type-helpers.ts"

type DbGroup = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { region: TText; amount: TNumeric }
				}
			}
		}
	}
}

type TGroupBy = ParseSqlStatement<ParseSqlTokens<`select region from sales group by region;`>, DbGroup>

type _groupByOk = Expect<Matches<TGroupBy[2], { kind: "select"; columns: { region: TText } }>>

type THaving = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region having region = 'eu';`>,
	DbGroup
>

type _havingOk = Expect<Matches<THaving[2], { kind: "select"; columns: { region: TText } }>>

type THavingBad = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region having not_a_col = 'x';`>,
	DbGroup
>

type _havingBad = Expect<Matches<THavingBad[2], SqlParserError<"Unknown column">>>

type TGroupProjViol = ParseSqlStatement<ParseSqlTokens<`select region, amount from sales group by region;`>, DbGroup>

type _groupProjViol = Expect<
	Matches<
		TGroupProjViol[2],
		SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>

type TGroupProjAggOk = ParseSqlStatement<
	ParseSqlTokens<`select region, sum(amount) as s from sales group by region;`>,
	DbGroup
>

type _groupProjAggOk = Expect<Matches<TGroupProjAggOk[2], { kind: "select"; columns: { region: TText; s: TNumeric } }>>

/** `HAVING` without `GROUP BY` still enforces “aggregates or constants / grouped columns” on projections. */
type THavingNoGroupBareCol = ParseSqlStatement<ParseSqlTokens<`select region from sales having count(*) > 0;`>, DbGroup>

type _havingNoGroupBareCol = Expect<
	Matches<
		THavingNoGroupBareCol[2],
		SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>

/** `HAVING` only — all selected values are aggregates. */
type THavingNoGroupAggOnly = ParseSqlStatement<
	ParseSqlTokens<`select count(*) as c from sales having count(*) > 0;`>,
	DbGroup
>

type _havingNoGroupAggOnly = Expect<Matches<THavingNoGroupAggOnly[2], { kind: "select"; columns: { c: TBigint } }>>

/** Multi-expression `GROUP BY`: both projected non-aggregates must appear in the key set. */
type TGroupByTwoKeysOk = ParseSqlStatement<
	ParseSqlTokens<`select region, amount from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysOk = Expect<
	Matches<TGroupByTwoKeysOk[2], { kind: "select"; columns: { region: TText; amount: TNumeric } }>
>

/** `GROUP BY region, amount` but `amount` omitted from projection list — ok (column appears in grouping). */
type TGroupByTwoKeysSubsetProj = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysSubsetProj = Expect<
	Matches<TGroupByTwoKeysSubsetProj[2], { kind: "select"; columns: { region: TText } }>
>

/** Literals are allowed in grouped contexts. */
type TGroupLitOk = ParseSqlStatement<ParseSqlTokens<`select region, 1 as one from sales group by region;`>, DbGroup>

type _groupLitOk = Expect<Matches<TGroupLitOk[2], { kind: "select"; columns: { region: TText; one: TInteger } }>>

/** `COUNT(*)` counts as aggregate in projection rules. */
type TGroupCountStar = ParseSqlStatement<
	ParseSqlTokens<`select region, count(*) as c from sales group by region;`>,
	DbGroup
>

type _groupCountStar = Expect<Matches<TGroupCountStar[2], { kind: "select"; columns: { region: TText; c: TBigint } }>>

/** Trailing `ORDER BY` / `LIMIT` / `OFFSET` after `GROUP BY` must not drop grouped-projection validation. */
type TGroupOrderLimit = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region order by region limit 10 offset 2;`>,
	DbGroup
>

type _groupOrderLimit = Expect<Matches<TGroupOrderLimit[2], { kind: "select"; columns: { region: TText } }>>

/** Same trail but projection violates grouped rules — still error. */
type TGroupOrderLimitBad = ParseSqlStatement<
	ParseSqlTokens<`select region, amount from sales group by region order by region limit 1;`>,
	DbGroup
>

type _groupOrderLimitBad = Expect<
	Matches<
		TGroupOrderLimitBad[2],
		SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>

describe("GROUP BY / HAVING (type tests)", () => {
	it("compile-time assertions above", () => {})
})
