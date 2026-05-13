import { describe, it } from "node:test"
import type { CreateParserMonad } from "../src/lexer/parser-monad.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { TInteger, TBoolean, TBooleanArray } from "./test-utils/sql-type-helpers.ts"

type DbTiny = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				sales: {
					kind: "table"
					columns: { id: TInteger }
				}
			}
		}
	}
}

/** Minimal `ARRAY[…]` + `@>` / `&&` operator typing (`ResolveCustomOp`). */
type TArrayOps = ParseSqlStatement<
	CreateParserMonad<`select array['z'] && array['z','z2'] as o1, array['a','b','c'] @> array['b'] as o2 from sales;`>,
	DbTiny
>

type _arrayOpsBool = Expect<
	Extends<
		TArrayOps[2],
		{
			kind: "select"
			columns: { o1: TBoolean; o2: TBoolean }
		}
	>
>

/** Chained subscript: `ARRAY[1,2,3][2]` parses as nested `array_index`. */
type TArrayChainedIndex = ParseSqlStatement<CreateParserMonad<`select array[1,2,3][2] as el from sales;`>, DbTiny>

type _arrayChainedIndex = Expect<Extends<TArrayChainedIndex[2], { kind: "select"; columns: { el: unknown } }>>

/** Unary `ARRAY` constructor only (no `@>` / `&&`). */
type TArrayCtorOnly = ParseSqlStatement<CreateParserMonad<`select array[true,false] as flags from sales;`>, DbTiny>

type _arrayCtorOnly = Expect<Extends<TArrayCtorOnly[2], { kind: "select"; columns: { flags: TBooleanArray } }>>

/** Empty `ARRAY[]` constructor (typed as empty readonly tuple). */
// TODO: Fix empty array error type after refactoring TS types out of parsers
// type TArrayEmpty = ParseSqlStatement<CreateParserMonad<`select array[] as e from sales;`>, DbTiny>
// type _arrayEmpty = Expect<Extends<TArrayEmpty[2], { kind: "select"; columns: { e: "__sql_parser_error__" } }>>

describe("PostgreSQL ARRAY constructor + containment / overlap ops (type tests)", () => {
	it("compile-time assertions above", () => {})
})
