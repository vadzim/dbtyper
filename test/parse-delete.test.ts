import { describe, it } from "node:test"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Matches } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/** Concrete `sets` so `keyof columns` does not widen with an index signature. */
type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
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

type TBad = ParseSqlStatement<ParseSqlTokens<`delete from users where users.nope = 'u';`>, DbUsers>
type _tBad = Expect<TBad[2] extends SqlParserError<string> ? true : false>

type TBadUnq = ParseSqlStatement<ParseSqlTokens<`delete from users where ghost = 'u';`>, DbUsers>
type _tBadUnq = Expect<TBadUnq[2] extends SqlParserError<string> ? true : false>

type TNoFrom = ParseSqlStatement<ParseSqlTokens<`delete users where id = 'u';`>, DbUsers>
type _tNoFrom = Expect<TNoFrom[2] extends SqlParserError<string> ? true : false>

/** End-of-input without `;` is accepted (same as `TokenEot` terminator elsewhere). */
type TNoSemi = ParseSqlStatement<ParseSqlTokens<`delete from users where id = 'u'`>, DbUsers>
type _tNoSemi = Expect<Matches<TNoSemi[2], null>>

type TUnknownTable = ParseSqlStatement<ParseSqlTokens<`delete from ghosts where id = 'u';`>, DbUsers>
type _tUnknownTable = Expect<TUnknownTable[2] extends SqlParserError<string> ? true : false>

type TAnd = ParseSqlStatement<ParseSqlTokens<`delete from users where users.id = 'u' and users.name = 'a';`>, DbUsers>
type _tAnd = Expect<Matches<TAnd[2], null>>

type TIsNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is null;`>, DbUsers>
type _tIsNull = Expect<Matches<TIsNull[2], null>>

type TIsNotNull = ParseSqlStatement<ParseSqlTokens<`delete from users where users.name is not null;`>, DbUsers>
type _tIsNotNull = Expect<Matches<TIsNotNull[2], null>>

describe("parse-delete (type tests)", () => {
	it("compile-time assertions above", () => {})
})
