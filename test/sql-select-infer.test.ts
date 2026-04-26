/**
 * `SelectRow` and `ApplySelect` against a small `JsqlDatabaseShape` value.
 */
import { describe, it } from "node:test"
import type { ApplySelect } from "../src/engine/apply-select.ts"
import type { SelectRow } from "../src/engine/infer-select-row.ts"
import type { SqlParserError } from "../core/sql-tokens.ts"
import type { SqlApplyStatement } from "../src/engine/apply-statement.ts"
import type { ParseSqlStatements } from "../src/parser/parse-sql-statement.ts"
import type { ParseSqlTokens } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"

type SmallDb = {
	defaultSchema: "public"
	schemas: {
		public: { tables: { t: { columns: { id: number; name: string } } } }
	}
}

type TwoTableDb = {
	defaultSchema: "public"
	schemas: {
		public: {
			tables: {
				users: { columns: { id: number; x: number } }
				orders: { columns: { uid: number } }
			}
		}
	}
}

type StarStmt = ParseSqlStatements<ParseSqlTokens<"select * from t;">>[1][0]
type _SelectRowStar = Expect<Matches<SelectRow<SmallDb, StarStmt>, { id: number; name: string }>>

type IdNameStmt = ParseSqlStatements<ParseSqlTokens<"select id, name from t;">>[1][0]
type _SelectRowNamed = Expect<Matches<SelectRow<SmallDb, IdNameStmt>, { id: number; name: string }>>

type BadColStmt = ParseSqlStatements<ParseSqlTokens<"select nope from t;">>[1][0]
type _SelectRowBad = Expect<Matches<SelectRow<SmallDb, BadColStmt>, SqlParserError<`Unknown column "nope" in SELECT`>>>

type JoinProj = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid;">
>[1][0]
type _JoinRow = Expect<Matches<SelectRow<TwoTableDb, JoinProj>, { uid: number }>>

type StarJoin = ParseSqlStatements<
	ParseSqlTokens<"select * from users join orders on users.id = orders.uid;">
>[1][0]
type _StarJoinErr = Expect<
	Matches<
		SelectRow<TwoTableDb, StarJoin>,
		SqlParserError<"SELECT * with JOIN is not supported for row typing; list columns explicitly">
	>
>

type WhereOrderOk = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid where users.x = 1 order by orders.uid desc;">
>[1][0]
type _WhereOrderRow = Expect<Matches<SelectRow<TwoTableDb, WhereOrderOk>, { uid: number }>>

type BadWhere = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid where z = 1;">
>[1][0]
type _BadWhere = Expect<
	Matches<SelectRow<TwoTableDb, BadWhere>, SqlParserError<`Unknown column "z" in WHERE or ORDER BY`>>
>

type BadOrderBy = ParseSqlStatements<
	ParseSqlTokens<"select uid from users join orders on users.id = orders.uid order by z;">
>[1][0]
type _BadOrderBy = Expect<
	Matches<SelectRow<TwoTableDb, BadOrderBy>, SqlParserError<`Unknown column "z" in WHERE or ORDER BY`>>
>

type AsAliasStmt = ParseSqlStatements<ParseSqlTokens<"select id as rid from t;">>[1][0]
type _AsAliasRow = Expect<Matches<SelectRow<SmallDb, AsAliasStmt>, { rid: number }>>

type LimitStmt = ParseSqlStatements<ParseSqlTokens<"select id from t limit 5 offset 1;">>[1][0]
type _LimitIgnoredRow = Expect<Matches<SelectRow<SmallDb, LimitStmt>, { id: number }>>

type _ApplyJoinOk = Expect<Matches<ApplySelect<TwoTableDb, JoinProj>, TwoTableDb>>

type _ApplyOk = Expect<Matches<SqlApplyStatement<SmallDb, StarStmt>, SmallDb>>
type _ApplyInvalid = Expect<Matches<SqlApplyStatement<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>
type _ApplySelectDirect = Expect<Matches<ApplySelect<SmallDb, StarStmt>, SmallDb>>
type _ApplySelectBad = Expect<Matches<ApplySelect<SmallDb, BadColStmt>, SelectRow<SmallDb, BadColStmt>>>

describe("sql select infer/apply (type tests)", () => {
	it("should run", () => {})
})
