import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { SqlDatabase } from "../src/core/sql-database.ts"
import type { ApplyStatements } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError, DbtyperError } from "../src/sql-parser-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../src/parser/parse-expression.ts"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { TInteger } from "./test-utils/sql-type-helpers.ts"
import type { SqlSelectRow } from "./test-utils/parser-test-utils.ts"
import type { PostgresTypeMap } from "../src/postgres/postgres-type-map.ts"

/**
 * Mirrors the private {@link SqlDatabase.query} constraint in `sql-database.ts`
 * (`CheckSqlValid`); documents that broken `SELECT`s resolve to parser messages, not literals.
 */
type CheckSqlValid<
	Db extends JsqlDatabaseShape | DbtyperError<any, any>,
	Stmt extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = [SqlSelectRow<Db, Stmt, PostgresTypeMap, Params>] extends [SqlParserError<infer Msg>] ? Msg : Stmt

/** Same seeded shape as **`parse-select.test.ts`** (**`DbJoinDefaultAndExplicit`**). */
type DbJoinUsersBilling = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create schema billing;
create table users ( id uuid not null, name text not null );
create table billing.subs ( id uuid not null, user_id uuid not null, plan_code text not null );
`
>[0]

type ChkGood = CheckSqlValid<DbJoinUsersBilling, `select users.id from users;`>
type _chkGood = Expect<Matches<ChkGood, `select users.id from users;`>>

type ChkBadCol = CheckSqlValid<DbJoinUsersBilling, `select users.nope from users;`>
type _chkBadCol = Expect<Matches<ChkBadCol, "Unknown qualified column">>

type ChkBadBare = CheckSqlValid<DbJoinUsersBilling, `select ghost from users;`>
type _chkBadBare = Expect<Matches<ChkBadBare, "Unknown column">>

type DbDefaultPublic = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				t: {
					kind: "table"
					columns: { id: TInteger }
				}
			}
		}
	}
}

/** `ApplyStatements` second slot — first DDL/`SELECT` error (bad view body here). */
type ApplyBadView = ApplyStatements<DbDefaultPublic, `create view bad_v as select nope_col from t;`>
type _applyBadViewErr = Expect<Matches<ApplyBadView[1], SqlParserError<"Unknown column">>>

/** DDL script stops on **`SELECT`** list error (**`ApplyStatements`**’s third slot surfaced as **`[1]`**). */
type ApplyBadSelectList = ApplyStatements<DbDefaultPublic, `create table ok_sel ( id int ); select 1, 2 from ok_sel;`>
type _applyBadSelectListErr = Expect<
	Matches<ApplyBadSelectList[1], SqlParserError<"Scalar expression in SELECT requires AS alias">>
>

describe("CheckSqlValid + migration apply errors (type tests)", () => {
	it("compile-time assertions above", () => {})
})
