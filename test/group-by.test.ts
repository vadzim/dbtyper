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

type TGroupProjViol = ParseSqlStatement<ParseSqlTokens<`select region, amount from sales group by region;`>, DbGroup>

type _groupProjViol = Expect<
	Extends<
		Tuple3At2<TGroupProjViol>,
		SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>

type TGroupProjAggOk = ParseSqlStatement<
	ParseSqlTokens<`select region, sum(amount) as ts from sales group by region;`>,
	DbGroup
>

type _groupProjAggOk = Expect<
	Extends<Tuple3At2<TGroupProjAggOk>, { kind: "select"; columns: { ts: number; region: string } }>
>

/** `HAVING` without `GROUP BY` still enforces “aggregates or constants / grouped columns” on projections. */
type THavingNoGroupBareCol = ParseSqlStatement<ParseSqlTokens<`select region from sales having count(*) > 0;`>, DbGroup>

type _havingNoGroupBareCol = Expect<
	Extends<
		Tuple3At2<THavingNoGroupBareCol>,
		SqlParserError<"Grouped SELECT requires column to appear in GROUP BY or inside an aggregate">
	>
>

/** `HAVING` only — all selected values are aggregates. */
type THavingNoGroupAggOnly = ParseSqlStatement<
	ParseSqlTokens<`select count(*) as c from sales having count(*) > 0;`>,
	DbGroup
>

type _havingNoGroupAggOnly = Expect<Extends<Tuple3At2<THavingNoGroupAggOnly>, JsqlSelectStatementResult>>

/** Multi-expression `GROUP BY`: both projected non-aggregates must appear in the key set. */
type TGroupByTwoKeysOk = ParseSqlStatement<
	ParseSqlTokens<`select region, amount from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysOk = Expect<Extends<Tuple3At2<TGroupByTwoKeysOk>, JsqlSelectStatementResult>>

/** `GROUP BY region, amount` but `amount` omitted from projection list — ok (column appears in grouping). */
type TGroupByTwoKeysSubsetProj = ParseSqlStatement<
	ParseSqlTokens<`select region from sales group by region, amount;`>,
	DbGroup
>

type _groupByTwoKeysSubsetProj = Expect<Extends<Tuple3At2<TGroupByTwoKeysSubsetProj>, JsqlSelectStatementResult>>

/** Literals are allowed in grouped contexts. */
type TGroupLitOk = ParseSqlStatement<ParseSqlTokens<`select region, 1 as one from sales group by region;`>, DbGroup>

type _groupLitOk = Expect<Extends<Tuple3At2<TGroupLitOk>, JsqlSelectStatementResult>>

/** `COUNT(*)` counts as aggregate in projection rules. */
type TGroupCountStar = ParseSqlStatement<
	ParseSqlTokens<`select region, count(*) as c from sales group by region;`>,
	DbGroup
>

type _groupCountStar = Expect<Extends<Tuple3At2<TGroupCountStar>, JsqlSelectStatementResult>>

describe("GROUP BY / HAVING (type tests)", () => {
	it("compile-time assertions above", () => {})
})
