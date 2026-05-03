import { describe, it } from "node:test"
import type { JsqlDatabaseShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"

type DbTiny = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { id: number }
					column_sql_types: { id: "integer" }
				}
			}
		}
	}
	scalarTypes: Record<string, unknown>
} & JsqlDatabaseShape

/** Minimal `ARRAY[…]` + `@>` / `&&` operator typing (`ResolveCustomOp`). */
type TArrayOps = ParseSqlStatement<
	ParseSqlTokens<`select array['z'] && array['z','z2'] as o1, array['a','b','c'] @> array['b'] as o2 from sales;`>,
	DbTiny
>

type _arrayOpsBool = Expect<
	Extends<
		Tuple3At2<TArrayOps>,
		{
			kind: "select"
			columns: { o1: boolean; o2: boolean }
		}
	>
>

describe("PostgreSQL ARRAY constructor + containment / overlap ops (type tests)", () => {
	it("compile-time assertions above", () => {})
})
