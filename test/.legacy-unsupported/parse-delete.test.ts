import { describe, it } from "node:test"
import type { CreateParserMonad } from "../../src/lexer/parser-monad.ts"
import { expectType, toBe } from "../test-utils/type-test-utils.ts"
import type { TText, TInteger } from "../test-utils/sql-type-helpers.ts"
import type { ParseSqlStatement } from "../../src/parser/parse-sql-statement.ts"

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
type T1 = ParseSqlStatement<CreateParserMonad<`delete from users where users.id = 'u';`>, DbUsers>
expectType<T1[2]>(toBe<null>())

type T2 = ParseSqlStatement<CreateParserMonad<`delete from users where id = 'u';`>, DbUsers>
expectType<T2[2]>(toBe<null>())

type T3 = ParseSqlStatement<CreateParserMonad<`delete from public.users where public.users.id = 'u';`>, DbUsers>
expectType<T3[2]>(toBe<null>())

/** End-of-input without `;` is accepted (same as `TokenEot` terminator elsewhere). */
type TNoSemi = ParseSqlStatement<CreateParserMonad<`delete from users where id = 'u'`>, DbUsers>
expectType<TNoSemi[2]>(toBe<null>())

type TAnd = ParseSqlStatement<
	CreateParserMonad<`delete from users where users.id = 'u' and users.name = 'a';`>,
	DbUsers
>
expectType<TAnd[2]>(toBe<null>())

type TIsNull = ParseSqlStatement<CreateParserMonad<`delete from users where users.name is null;`>, DbUsers>
expectType<TIsNull[2]>(toBe<null>())

type TIsNotNull = ParseSqlStatement<CreateParserMonad<`delete from users where users.name is not null;`>, DbUsers>
expectType<TIsNotNull[2]>(toBe<null>())

/** End-to-end `ParseSqlStatement`: `BETWEEN` / `LIKE` (not only `ParseWhereExpression`). */
type TDelBetween = ParseSqlStatement<
	CreateParserMonad<`delete from users where users.name between 'a' and 'z';`>,
	DbUsers
>
expectType<TDelBetween[2]>(toBe<null>())

type TDelLike = ParseSqlStatement<CreateParserMonad<`delete from users where users.name like 'x%';`>, DbUsers>
expectType<TDelLike[2]>(toBe<null>())

describe("parse-delete (type tests)", () => {
	it("compile-time assertions above", () => {})
})
