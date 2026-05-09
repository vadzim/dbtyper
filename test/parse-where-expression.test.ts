import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { _DbtyperError } from "../src/sql-parser-error.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type { Expect, Extends, _Matches } from "./test-utils/type-test-utils.ts"
import type { TText, TInteger, TNumeric, TUuid } from "./test-utils/sql-type-helpers.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"
import type { HasAmbiguousUnqualifiedColumn } from "../src/parser/scope-unqualified-helpers.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TText; name: TText }
				}
			}
		}
	}
}

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: TText; name: TText }
}

type UsersScope = Record<"users", UsersEntry>

type W1 = ParseWhereExpression<ParseSqlTokens<`users.id = 'u'`>, DbUsers, UsersScope>
type _w1 = Expect<Extends<W1[1], null>>

type W3part = ParseWhereExpression<ParseSqlTokens<`public.users.id = 'u'`>, DbUsers, UsersScope>
type _w3part = Expect<Extends<W3part[1], null>>

type InnerScope = Record<"inner_t", { schema: "public"; table: "inner_t"; columns: { a: TInteger } }>
type OuterScope = Record<"outer_t", { schema: "public"; table: "outer_t"; columns: { b: TText } }>

/** Caller merges scopes (e.g. enclosing + inner `FROM`) — `outer_t.b` resolves in the combined map. */
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>
type WTwoLayer = ParseWhereExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner>
type _wTwoLayer = Expect<Extends<WTwoLayer[1], null>>

type WAnd = ParseWhereExpression<ParseSqlTokens<`users.id = 'u' and users.name is null`>, DbUsers, UsersScope>
type _wAnd = Expect<Extends<WAnd[1], null>>

/** PostgreSQL `~`: regex match on text columns. */
type WRegex = ParseWhereExpression<ParseSqlTokens<`users.name ~ 'a'`>, DbUsers, UsersScope>
type _wRegex = Expect<Extends<WRegex[1], null>>

/** Success: comparison operators and literals. */
type WNe = ParseWhereExpression<ParseSqlTokens<`users.id <> 'v'`>, DbUsers, UsersScope>
type _wNe = Expect<Extends<WNe[1], null>>
type WNeBang = ParseWhereExpression<ParseSqlTokens<`users.id != 'v'`>, DbUsers, UsersScope>
type _wNeBang = Expect<Extends<WNeBang[1], null>>
type WLe = ParseWhereExpression<ParseSqlTokens<`users.name <= 'z'`>, DbUsers, UsersScope>
type _wLe = Expect<Extends<WLe[1], null>>
type WStr = ParseWhereExpression<ParseSqlTokens<`users.name = 'a'`>, DbUsers, UsersScope>
type _wStr = Expect<Extends<WStr[1], null>>



/** Success: `IS NOT NULL`, `IN (...)`, nested parens, `OR` inside parens. */
type WIsNotNull = ParseWhereExpression<ParseSqlTokens<`users.name is not null`>, DbUsers, UsersScope>
type _wIsNotNull = Expect<Extends<WIsNotNull[1], null>>
type WInList = ParseWhereExpression<ParseSqlTokens<`users.id in ( 'a' , 'b' )`>, DbUsers, UsersScope>
type _wInList = Expect<Extends<WInList[1], null>>


type WNested = ParseWhereExpression<ParseSqlTokens<`( ( users.id = 'u' ) )`>, DbUsers, UsersScope>
type _wNested = Expect<Extends<WNested[1], null>>
type WOrInParens = ParseWhereExpression<
	ParseSqlTokens<`users.id = 'u' and ( users.name = 'a' or users.name = 'b' )`>,
	DbUsers,
	UsersScope
>
type _wOrInParens = Expect<Extends<WOrInParens[1], null>>

type WNotNot = ParseWhereExpression<ParseSqlTokens<`not not users.id = 'u'`>, DbUsers, UsersScope>
type _wNotNot = Expect<Extends<WNotNot[1], null>>

/** `BETWEEN`: bounds same comparison class as subject. */
type WBetween = ParseWhereExpression<ParseSqlTokens<`users.name between 'a' and 'z'`>, DbUsers, UsersScope>
type _wBetween = Expect<Extends<WBetween[1], null>>


/** `BETWEEN`: numeric column vs string bounds (same as SQL type mismatch at resolve). */
type _DbUsersWithAmount = {
	defaultSchema: "public"
	schemas: {
		public: {
			sets: {
				users: {
					kind: "table"
					columns: { id: TUuid; name: TText; amount: TNumeric }
				}
			}
		}
	}
}
type _UsersScopeWithAmount = Record<
	"users",
	{
		schema: "public"
		table: "users"
		columns: { id: TUuid; name: TText; amount: TNumeric }
	}
>




/** `LIKE` / `ILIKE`: both sides text. */
type WLike = ParseWhereExpression<ParseSqlTokens<`users.name like '%x%'`>, DbUsers, UsersScope>
type _wLike = Expect<Extends<WLike[1], null>>
type WILike = ParseWhereExpression<ParseSqlTokens<`users.name ilike '%X%'`>, DbUsers, UsersScope>
type _wILike = Expect<Extends<WILike[1], null>>

type _JoinedUsersInner = MergeScope<UsersScope, InnerScope>








/** Searched `CASE WHEN … THEN … [ELSE …] END`. */
type WCase = ParseWhereExpression<
	ParseSqlTokens<`case when users.name = 'a' then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCase = Expect<Extends<WCase[1], null>>



/** Simple `CASE expr WHEN value …` — `WHEN` values use `=` comparison-class rules against `expr`. */
type WCaseSimple = ParseWhereExpression<
	ParseSqlTokens<`case users.id when 'u' then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCaseSimple = Expect<Extends<WCaseSimple[1], null>>

/** No `ELSE`: result type is `boolean | null`, which is not a valid bare `WHERE` root. */
type WCaseSimpleNoElse = ParseWhereExpression<
	ParseSqlTokens<`case users.id when 'u' then true end`>,
	DbUsers,
	UsersScope
>
type _wCaseSimpleNoElse = Expect<Extends<WCaseSimpleNoElse[1], null>>




type WCastTextToInteger = ParseWhereExpression<ParseSqlTokens<`cast(users.name as integer) = 1`>, DbUsers, UsersScope>
type _wCastTextToInteger = Expect<Extends<WCastTextToInteger[1], null>>

/**
 * Bare-column ambiguity is decided with a literal `Col` in `ValidateWhereColumnParts`.
 * `ParseSqlTokens` widens bare identifiers to `string`, so full-parser ambiguity is not asserted here;
 * the helper below is the same predicate used for `"Ambiguous unqualified column"` / SELECT.
 */
/** `MergeScope` keeps literal aliases (plain `{ t1, t2 }` can widen `keyof` under `Record` constraints). */
type AmbigScope = MergeScope<
	Record<"t1", { schema: "public"; table: "t1"; columns: { id: TUuid } }>,
	Record<"t2", { schema: "public"; table: "t2"; columns: { id: TUuid } }>
>
type _ambigHelper = Expect<Extends<HasAmbiguousUnqualifiedColumn<AmbigScope, "id">, true>>

describe("parse-where-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
