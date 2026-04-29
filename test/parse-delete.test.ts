import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Matches, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { PackageScalarTypes } from "./test-utils/package-scalar-types.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** Concrete `sets` so `keyof columns` does not widen with an index signature. */
type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string; amount: number }
					column_sql_types: { id: "uuid"; name: "text" }
				}
			}
		}
	}
	scalarTypes: PackageScalarTypes
}

/** Tokens after `delete` (i.e. start with `from`). */
type T1 = ParseSqlStatement<ParseSqlTokens<`delete from users where users.id = 'u';`>, DbUsers>
type _t1null = Expect<Matches<Tuple3At2<T1>, null>>

type T2 = ParseSqlStatement<ParseSqlTokens<`delete from users where id = 'u';`>, DbUsers>
type _t2null = Expect<Matches<Tuple3At2<T2>, null>>

type T3 = ParseSqlStatement<ParseSqlTokens<`delete from public.users where public.users.id = 'u';`>, DbUsers>
type _t3null = Expect<Matches<Tuple3At2<T3>, null>>

type TBad = ParseSqlStatement<ParseSqlTokens<`delete from users where users.nope = 'u';`>, DbUsers>
type _tBad = Expect<Extends<Tuple3At2<TBad>, SqlParserError<string>>>

type TBadUnq = ParseSqlStatement<ParseSqlTokens<`delete from users where ghost = 'u';`>, DbUsers>
type _tBadUnq = Expect<Extends<Tuple3At2<TBadUnq>, SqlParserError<string>>>

type TNoFrom = ParseSqlStatement<ParseSqlTokens<`delete users where id = 'u';`>, DbUsers>
type _tNoFrom = Expect<Extends<Tuple3At2<TNoFrom>, SqlParserError<string>>>

/** End-of-input without `;` is accepted (same as `TokenEot` terminator elsewhere). */
type TNoSemi = ParseSqlStatement<ParseSqlTokens<`delete from users where id = 'u'`>, DbUsers>
type _tNoSemi = Expect<Matches<Tuple3At2<TNoSemi>, null>>

type TUnknownTable = ParseSqlStatement<ParseSqlTokens<`delete from ghosts where id = 'u';`>, DbUsers>
type _tUnknownTable = Expect<Extends<Tuple3At2<TUnknownTable>, SqlParserError<string>>>

type TAnd = ParseSqlStatement<ParseSqlTokens<`delete from users where users.id = 'u' and users.name = 'a';`>, DbUsers>
type _tAnd = Expect<Matches<Tuple3At2<TAnd>, null>>

type TIsNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is null;`>, DbUsers>
type _tIsNull = Expect<Matches<Tuple3At2<TIsNull>, null>>

type TIsNotNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is not null;`>, DbUsers>
type _tIsNotNull = Expect<Matches<Tuple3At2<TIsNotNull>, null>>

/** End-to-end `ParseSqlStatement`: `BETWEEN` / `LIKE` (not only `ParseWhereExpression`). */
type TDelBetween = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name between 'a' and 'z';`>, DbUsers>
type _tDelBetween = Expect<Matches<Tuple3At2<TDelBetween>, null>>

type TDelLike = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name like 'x%';`>, DbUsers>
type _tDelLike = Expect<Matches<Tuple3At2<TDelLike>, null>>

describe("parse-delete (type tests)", () => {
	it("compile-time assertions above", () => {})
})
