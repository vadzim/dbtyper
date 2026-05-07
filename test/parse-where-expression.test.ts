import { describe, it } from "node:test"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
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

type WBadQual = ParseWhereExpression<ParseSqlTokens<`users.nope = 'x'`>, DbUsers, UsersScope>
type _wBadQual = Expect<Extends<WBadQual[1], SqlParserError<"Unknown qualified column">>>

type WBadBare = ParseWhereExpression<ParseSqlTokens<`ghost = 'x'`>, DbUsers, UsersScope>
type _wBadBare = Expect<Extends<WBadBare[1], SqlParserError<"Unknown column">>>

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

/** Catalog-qualified `schema.table.column`: missing table. */
type W3badTab = ParseWhereExpression<ParseSqlTokens<`public.nope.id = 'u'`>, DbUsers, UsersScope>
type _w3badTab = Expect<Extends<W3badTab[1], SqlParserError<"Unknown schema or table">>>

/** Catalog-qualified column: unknown schema. */
type W3badSch = ParseWhereExpression<ParseSqlTokens<`missing.users.id = 'u'`>, DbUsers, UsersScope>
type _w3badSch = Expect<Extends<W3badSch[1], SqlParserError<"Unknown schema or table">>>

/** Catalog-qualified column: known table, unknown column. */
type W3badCol = ParseWhereExpression<ParseSqlTokens<`public.users.nope = 'u'`>, DbUsers, UsersScope>
type _w3badCol = Expect<Extends<W3badCol[1], SqlParserError<"Unknown column (schema.table.column)">>>

/** Two-part qualified: alias not in scope. */
type W2badAlias = ParseWhereExpression<ParseSqlTokens<`nope.id = 'u'`>, DbUsers, UsersScope>
type _w2badAlias = Expect<Extends<W2badAlias[1], SqlParserError<"Unknown qualified column">>>

/** RHS subexpression: missing closing `)` (typed value paren uses `ParseExpressionAST` inside `)`). */
type WUnbalRhs = ParseWhereExpression<ParseSqlTokens<`users.id = ( 'u'`>, DbUsers, UsersScope>
type _wUnbalRhs = Expect<Extends<WUnbalRhs[1], SqlParserError<"Expected `)`">>>

/** `IN` list: missing closing `)` (after a valid list element, expect `,` or `)`). */
type WUnbalIn = ParseWhereExpression<ParseSqlTokens<`users.id in ( 'u'`>, DbUsers, UsersScope>
type _wUnbalIn = Expect<Extends<WUnbalIn[1], SqlParserError<"Expected `,` or `)` in IN list">>>

/** Empty `IN ()` list. */
type WInEmpty = ParseWhereExpression<ParseSqlTokens<`users.id in ()`>, DbUsers, UsersScope>
type _wInEmpty = Expect<Extends<WInEmpty[1], SqlParserError<"IN list must not be empty">>>

/** `IN` without `(`. */
type WInNoParen = ParseWhereExpression<ParseSqlTokens<`users.id in 'u'`>, DbUsers, UsersScope>
type _wInNoParen = Expect<Extends<WInNoParen[1], SqlParserError<"Expected `(` after IN">>>

/** `IS` must be followed by `NULL` (not arbitrary identifier). */
type WIsBad = ParseWhereExpression<ParseSqlTokens<`users.name is users`>, DbUsers, UsersScope>
type _wIsBad = Expect<Extends<WIsBad[1], SqlParserError<"Expected NULL after IS">>>

/** `IS NOT` must be followed by `NULL`. */
type WIsNotBad = ParseWhereExpression<ParseSqlTokens<`users.name is not true`>, DbUsers, UsersScope>
type _wIsNotBad = Expect<Extends<WIsNotBad[1], SqlParserError<"Expected NULL after IS NOT">>>

/** Grouped WHERE: inner ok but outer `)` missing. */
type WGrpNoClose = ParseWhereExpression<ParseSqlTokens<`( users.id = 'u'`>, DbUsers, UsersScope>
type _wGrpNoClose = Expect<Extends<WGrpNoClose[1], SqlParserError<"Expected `)`">>>

/** Operand position: token stream not a valid operand (e.g. lone `+`). */
type WUnexpectedRhs = ParseWhereExpression<ParseSqlTokens<`users.id = +`>, DbUsers, UsersScope>
type _wUnexpectedRhs = Expect<Extends<WUnexpectedRhs[1], SqlParserError<"Unexpected token">>>

/** `OR` second conjunct: bad column. */
type WOrBad = ParseWhereExpression<ParseSqlTokens<`users.id = 'u' or users.nope = 'v'`>, DbUsers, UsersScope>
type _wOrBad = Expect<Extends<WOrBad[1], SqlParserError<"Unknown qualified column">>>

/** `AND` second conjunct: bad column. */
type WAndBad = ParseWhereExpression<ParseSqlTokens<`users.id = 'u' and users.nope = 'v'`>, DbUsers, UsersScope>
type _wAndBad = Expect<Extends<WAndBad[1], SqlParserError<"Unknown qualified column">>>

/** Unary `NOT` then invalid column ref. */
type WNotBad = ParseWhereExpression<ParseSqlTokens<`not users.nope = 'u'`>, DbUsers, UsersScope>
type _wNotBad = Expect<Extends<WNotBad[1], SqlParserError<"Unknown qualified column">>>

/** Function-like call on RHS: missing closing `)` in argument list. */
type WFuncUnbal = ParseWhereExpression<ParseSqlTokens<`users.id = lower( 'x'`>, DbUsers, UsersScope>
type _wFuncUnbal = Expect<Extends<WFuncUnbal[1], SqlParserError<"Expected `,` or `)` in argument list">>>

/** Success: comparison operators and literals. */
type WNe = ParseWhereExpression<ParseSqlTokens<`users.id <> 'v'`>, DbUsers, UsersScope>
type _wNe = Expect<Extends<WNe[1], null>>
type WNeBang = ParseWhereExpression<ParseSqlTokens<`users.id != 'v'`>, DbUsers, UsersScope>
type _wNeBang = Expect<Extends<WNeBang[1], null>>
type WLe = ParseWhereExpression<ParseSqlTokens<`users.name <= 'z'`>, DbUsers, UsersScope>
type _wLe = Expect<Extends<WLe[1], null>>
type WStr = ParseWhereExpression<ParseSqlTokens<`users.name = 'a'`>, DbUsers, UsersScope>
type _wStr = Expect<Extends<WStr[1], null>>
type WBool = ParseWhereExpression<ParseSqlTokens<`users.id = true`>, DbUsers, UsersScope>
type _wBool = Expect<Extends<WBool[1], SqlParserError<"Incompatible types in comparison">>>
type WNullRhs = ParseWhereExpression<ParseSqlTokens<`users.id = null`>, DbUsers, UsersScope>
type _wNullRhs = Expect<Extends<WNullRhs[1], SqlParserError<"Use IS NULL instead of = null">>>

/** Success: `IS NOT NULL`, `IN (...)`, nested parens, `OR` inside parens. */
type WIsNotNull = ParseWhereExpression<ParseSqlTokens<`users.name is not null`>, DbUsers, UsersScope>
type _wIsNotNull = Expect<Extends<WIsNotNull[1], null>>
type WInList = ParseWhereExpression<ParseSqlTokens<`users.id in ( 'a' , 'b' )`>, DbUsers, UsersScope>
type _wInList = Expect<Extends<WInList[1], null>>

/** `IN` list: each element must match the left-hand comparison class (`uuid` column vs number literals). */
type WInListTypeErr = ParseWhereExpression<ParseSqlTokens<`users.id in ( 1, 2 )`>, DbUsers, UsersScope>
type _wInListTypeErr = Expect<Extends<WInListTypeErr[1], SqlParserError<"Incompatible types in IN list">>>
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
type WBetweenBad = ParseWhereExpression<ParseSqlTokens<`users.name between 1 and 2`>, DbUsers, UsersScope>
type _wBetweenBad = Expect<Extends<WBetweenBad[1], SqlParserError<"Incompatible types in BETWEEN">>>

/** `BETWEEN`: numeric column vs string bounds (same as SQL type mismatch at resolve). */
type DbUsersWithAmount = {
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
type UsersScopeWithAmount = Record<
	"users",
	{
		schema: "public"
		table: "users"
		columns: { id: TUuid; name: TText; amount: TNumeric }
	}
>
type WBetweenNumColStringBounds = ParseWhereExpression<
	ParseSqlTokens<`users.amount between 'a' and 'z'`>,
	DbUsersWithAmount,
	UsersScopeWithAmount
>
type _wBetweenNumColStringBounds = Expect<
	Extends<WBetweenNumColStringBounds[1], SqlParserError<"Incompatible types in BETWEEN">>
>

type WBetweenNullBound = ParseWhereExpression<ParseSqlTokens<`inner_t.a between null and 1`>, DbUsers, JoinedUsersInner>
type _wBetweenNullBound = Expect<Extends<WBetweenNullBound[1], SqlParserError<"NULL not allowed in BETWEEN">>>

/** `LIKE` / `ILIKE`: both sides text. */
type WLike = ParseWhereExpression<ParseSqlTokens<`users.name like '%x%'`>, DbUsers, UsersScope>
type _wLike = Expect<Extends<WLike[1], null>>
type WILike = ParseWhereExpression<ParseSqlTokens<`users.name ilike '%X%'`>, DbUsers, UsersScope>
type _wILike = Expect<Extends<WILike[1], null>>

type JoinedUsersInner = MergeScope<UsersScope, InnerScope>
type WLikeNum = ParseWhereExpression<ParseSqlTokens<`inner_t.a like '1'`>, DbUsers, JoinedUsersInner>
type _wLikeNum = Expect<Extends<WLikeNum[1], SqlParserError<"LIKE left operand must be text">>>

type WLikePatternNonText = ParseWhereExpression<ParseSqlTokens<`users.name like 1`>, DbUsers, UsersScope>
type _wLikePatternNonText = Expect<Extends<WLikePatternNonText[1], SqlParserError<"LIKE pattern must be text">>>

type WLikeNullPattern = ParseWhereExpression<ParseSqlTokens<`users.name like null`>, DbUsers, UsersScope>
type _wLikeNullPattern = Expect<Extends<WLikeNullPattern[1], SqlParserError<"NULL not allowed in LIKE">>>

type WILikePatternNonText = ParseWhereExpression<ParseSqlTokens<`users.name ilike 1`>, DbUsers, UsersScope>
type _wILikePatternNonText = Expect<Extends<WILikePatternNonText[1], SqlParserError<"LIKE pattern must be text">>>

/** Searched `CASE WHEN … THEN … [ELSE …] END`. */
type WCase = ParseWhereExpression<
	ParseSqlTokens<`case when users.name = 'a' then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCase = Expect<Extends<WCase[1], null>>
type WCaseWhenNotBool = ParseWhereExpression<
	ParseSqlTokens<`case when 1 then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCaseWhenNotBool = Expect<Extends<WCaseWhenNotBool[1], SqlParserError<"CASE WHEN must be boolean">>>
type WCaseIncompat = ParseWhereExpression<ParseSqlTokens<`case when true then 1 else 'x' end`>, DbUsers, UsersScope>
type _wCaseIncompat = Expect<Extends<WCaseIncompat[1], SqlParserError<"Incompatible types in CASE">>>

/** Simple `CASE expr WHEN value …` — `WHEN` values use `=` comparison-class rules against `expr`. */
type WCaseSimple = ParseWhereExpression<
	ParseSqlTokens<`case users.id when 'u' then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCaseSimple = Expect<Extends<WCaseSimple[1], null>>
type WCaseSimpleWhenMismatch = ParseWhereExpression<
	ParseSqlTokens<`case users.name when 1 then true else false end`>,
	DbUsers,
	UsersScope
>
type _wCaseSimpleWhenMismatch = Expect<
	Extends<WCaseSimpleWhenMismatch[1], SqlParserError<"Incompatible types in comparison">>
>
/** No `ELSE`: result type is `boolean | null`, which is not a valid bare `WHERE` root. */
type WCaseSimpleNoElse = ParseWhereExpression<
	ParseSqlTokens<`case users.id when 'u' then true end`>,
	DbUsers,
	UsersScope
>
type _wCaseSimpleNoElse = Expect<Extends<WCaseSimpleNoElse[1], null>>

/** Arithmetic (`ParseAddValue` chain): both operands must be numbers; NULL rejected. */
type WArithNumPlusString = ParseWhereExpression<ParseSqlTokens<`inner_t.a + 'x'`>, DbUsers, JoinedUsersInner>
type _wArithNumPlusString = Expect<Extends<WArithNumPlusString[1], SqlParserError<"Incompatible types in arithmetic">>>
type WArithStringPlusNum = ParseWhereExpression<ParseSqlTokens<`'x' + inner_t.a`>, DbUsers, JoinedUsersInner>
type _wArithStringPlusNum = Expect<Extends<WArithStringPlusNum[1], SqlParserError<"Incompatible types in arithmetic">>>
type WArithNull = ParseWhereExpression<ParseSqlTokens<`inner_t.a + null`>, DbUsers, JoinedUsersInner>
type _wArithNull = Expect<Extends<WArithNull[1], SqlParserError<"NULL not allowed in arithmetic">>>

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
