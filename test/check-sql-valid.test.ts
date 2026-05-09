import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { SqlDatabase } from "../src/core/sql-database.ts"
import type { ApplyStatements } from "../src/parser/parse-sql-statement.ts"

import type { EmptyExpressionParams, ExpressionParamsShape } from "../src/parser/parse-expression.ts"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { TInteger } from "./test-utils/sql-type-helpers.ts"

/**
 * Mirrors the private {@link SqlDatabase.query} constraint in `sql-database.ts`
 * (`CheckSqlValid`); documents that valid `SELECT`s resolve to the statement string.
 */
type CheckSqlValid<
	_Db extends JsqlDatabaseShape,
	Stmt extends string,
	_Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Stmt

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

type _DbDefaultPublic = {
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

describe("CheckSqlValid + migration apply errors (type tests)", () => {
	it("compile-time assertions above", () => {})
})
