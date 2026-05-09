import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"

import type { Expect, Extends as _Extends, Matches } from "./test-utils/type-test-utils.ts"
import type { TText, TInteger } from "./test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** Concrete `sets` so `keyof columns` does not widen with an index signature. */
type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText; amount: TInteger }
				}
			}
		}
	}
}

/** Tokens after `delete` (i.e. start with `from`). */
type T1 = ParseSqlStatement<ParseSqlTokens<`delete from users where users.id = 'u';`>, DbUsers>
type _t1null = Expect<Matches<T1[2], null>>

type T2 = ParseSqlStatement<ParseSqlTokens<`delete from users where id = 'u';`>, DbUsers>
type _t2null = Expect<Matches<T2[2], null>>

type T3 = ParseSqlStatement<ParseSqlTokens<`delete from public.users where public.users.id = 'u';`>, DbUsers>
type _t3null = Expect<Matches<T3[2], null>>

/** End-of-input without `;` is accepted (same as `TokenEot` terminator elsewhere). */
type TNoSemi = ParseSqlStatement<ParseSqlTokens<`delete from users where id = 'u'`>, DbUsers>
type _tNoSemi = Expect<Matches<TNoSemi[2], null>>

type TAnd = ParseSqlStatement<ParseSqlTokens<`delete from users where users.id = 'u' and users.name = 'a';`>, DbUsers>
type _tAnd = Expect<Matches<TAnd[2], null>>

type TIsNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is null;`>, DbUsers>
type _tIsNull = Expect<Matches<TIsNull[2], null>>

type TIsNotNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is not null;`>, DbUsers>
type _tIsNotNull = Expect<Matches<TIsNotNull[2], null>>

/** End-to-end `ParseSqlStatement`: `BETWEEN` / `LIKE` (not only `ParseWhereExpression`). */
type TDelBetween = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name between 'a' and 'z';`>, DbUsers>
type _tDelBetween = Expect<Matches<TDelBetween[2], null>>

type TDelLike = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name like 'x%';`>, DbUsers>
type _tDelLike = Expect<Matches<TDelLike[2], null>>

describe("parse-delete (type tests)", () => {
	it("compile-time assertions above", () => {})
})
