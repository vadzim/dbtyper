import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError, DbtyperError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TInteger, TUuid } from "./test-utils/sql-type-helpers.ts"
import type { InferSqlErrors, SqlSelectRow } from "./test-utils/parser-test-utils.ts"

type DbU = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				u: { kind: "table"; columns: { id: TUuid; n: TInteger } }
			}
		}
	}
} & JsqlDatabaseShape
type DbFns = DbU & { functions: { custom_fn: TInteger } }
type I1 = InferSqlErrors<DbFns, `select u.id as x from u`>
type _i1 = Expect<Extends<I1, null>>





type I6 = InferSqlErrors<DbFns, `with c as (select u.id as cid from u) select c.cid from u`>
type _i6 = Expect<Extends<I6, null>>

/** {@link SqlSelectRow} matches projection after successful inference. */
type Row1 = SqlSelectRow<DbFns, `select custom_fn(n) as cf from u`>
type _row1 = Expect<Extends<Row1, { cf: number }>>
type RowInsertReturning = SqlSelectRow<
	DbFns,
	`insert into u (id, n) values ('11111111-1111-1111-1111-111111111111'::uuid, 1) returning id, n`
>
type _rowInsertReturning = Expect<Extends<RowInsertReturning, { id: string; n: number }>>
type RowUpdateReturning = SqlSelectRow<DbFns, `update u set n = 2 returning id`>
type _rowUpdateReturning = Expect<Extends<RowUpdateReturning, { id: string }>>
type RowDeleteReturning = SqlSelectRow<DbFns, `delete from u returning id`>
type _rowDeleteReturning = Expect<Extends<RowDeleteReturning, { id: string }>>
describe("InferSqlErrors / SqlSelectRow (type tests)", () => {
	it("compile-time assertions above", () => {})
})
