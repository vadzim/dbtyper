import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { InferSqlErrors, SqlSelectRow } from "../src/core/sql-query.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbU = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				u: { kind: "table"; columns: { id: string; n: number }; column_sql_types: { id: "uuid"; n: "integer" } }
			}
		}
	}
	scalarTypes: Record<string, unknown>
} & JsqlDatabaseShape

type DbFns = DbU & { functions: { custom_fn: number } }

type I1 = InferSqlErrors<DbFns, `select u.id as x from u`>
type _i1 = Expect<Extends<I1, null>>

type I2 = InferSqlErrors<DbFns, `select u.nope from u`>
type _i2 = Expect<Extends<I2, SqlParserError<string>>>

type I3 = InferSqlErrors<DbFns, `select id, n from u group by id`>
type _i3 = Expect<Extends<I3, SqlParserError<string>>>

/** Statement parse rejects `functions` keys that miss the arity/call shape (cheap vs unregistered names). */
type TripleBuiltinArity = Tuple3At2<ParseSqlStatement<ParseSqlTokens<`select now(1) from u`>, DbFns>>
type _tripleBuiltinArity = Expect<Extends<TripleBuiltinArity, SqlParserError<string>>>

/** Empty `sum()` is an argument error InferSqlErrors should surface as non-null tooling hook. */
type I4 = InferSqlErrors<DbFns, `select sum() from u`>
type _i4 = Expect<Extends<I4, SqlParserError<string>>>

type I5 = InferSqlErrors<DbFns, `delete from u`>
type _i5 = Expect<Extends<I5, SqlParserError<"Expected SELECT (or WITH … SELECT) for row typing">>>

/** {@link SqlSelectRow} matches projection after successful inference. */
type Row1 = SqlSelectRow<DbFns, `select custom_fn(n) as cf from u`>
type _row1 = Expect<Extends<Row1, { cf: number }>>

describe("InferSqlErrors / SqlSelectRow (type tests)", () => {
	it("compile-time assertions above", () => {})
})
