import { describe, it } from "node:test"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

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

type TGroupBy = ParseSqlStatement<CreateParserMonad<`select region from sales group by region;`>, DbGroup>

type _groupByOk = Expect<Matches<TGroupBy[2], { kind: "select"; columns: { region: TText } }>>

type THaving = ParseSqlStatement<
	CreateParserMonad<`select region from sales group by region having region = 'eu';`>,
	DbGroup
>

type _havingOk = Expect<Matches<THaving[2], { kind: "select"; columns: { region: TText } }>>

type _TGroupProjAggOk = ParseSqlStatement<
	CreateParserMonad<`select region, sum(amount) as s from sales group by region;`>,
	DbGroup
>

type THavingNoGroupAggOnly = ParseSqlStatement<
	CreateParserMonad<`select count(*) as c from sales having count(*) > 0;`>,
	DbGroup
>

type _havingNoGroupAggOnly = Expect<Matches<THavingNoGroupAggOnly[2], { kind: "select"; columns: { c: TBigint } }>>

/** Multi-expression `GROUP BY`: both projected non-aggregates must appear in the key set. */
type TGroupByTwoKeysOk = ParseSqlStatement<
	CreateParserMonad<`select region, amount from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysOk = Expect<
	Matches<TGroupByTwoKeysOk[2], { kind: "select"; columns: { region: TText; amount: TNumeric } }>
>

/** `GROUP BY region, amount` but `amount` omitted from projection list — ok (column appears in grouping). */
type TGroupByTwoKeysSubsetProj = ParseSqlStatement<
	CreateParserMonad<`select region from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysSubsetProj = Expect<
	Matches<TGroupByTwoKeysSubsetProj[2], { kind: "select"; columns: { region: TText } }>
>

/** Literals are allowed in grouped contexts. */
type TGroupLitOk = ParseSqlStatement<CreateParserMonad<`select region, 1 as one from sales group by region;`>, DbGroup>

type _groupLitOk = Expect<Matches<TGroupLitOk[2], { kind: "select"; columns: { region: TText; one: TInteger } }>>

/** `COUNT(*)` counts as aggregate in projection rules. */
type TGroupCountStar = ParseSqlStatement<
	CreateParserMonad<`select region, count(*) as c from sales group by region;`>,
	DbGroup
>

type _groupCountStar = Expect<Matches<TGroupCountStar[2], { kind: "select"; columns: { region: TText; c: TBigint } }>>

/** Trailing `ORDER BY` / `LIMIT` / `OFFSET` after `GROUP BY` must not drop grouped-projection validation. */
type TGroupOrderLimit = ParseSqlStatement<
	CreateParserMonad<`select region from sales group by region order by region limit 10 offset 2;`>,
	DbGroup
>

type _groupOrderLimit = Expect<Matches<TGroupOrderLimit[2], { kind: "select"; columns: { region: TText } }>>

describe("GROUP BY / HAVING (type tests)", () => {
	it("compile-time assertions above", () => {})
})
