import { describe, it } from "node:test"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect } from "./test-utils/type-test-utils.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"
import type { HasAmbiguousUnqualifiedColumn } from "../src/parser/scope-unqualified-helpers.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: {
			tables: {
				users: {
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
				}
			}
		}
	}
}

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: string; name: string }
	column_sql_types: { id: "uuid"; name: "text" }
}

type UsersScope = Record<"users", UsersEntry>

type W1 = ParseWhereExpression<ParseSqlTokens<`users.id = 1`>, DbUsers, UsersScope>
type _w1 = Expect<W1[1] extends null ? true : false>

type WBadQual = ParseWhereExpression<ParseSqlTokens<`users.nope = 1`>, DbUsers, UsersScope>
type _wBadQual = Expect<WBadQual[1] extends SqlParserError<"Unknown qualified column in WHERE"> ? true : false>

type WBadBare = ParseWhereExpression<ParseSqlTokens<`ghost = 1`>, DbUsers, UsersScope>
type _wBadBare = Expect<WBadBare[1] extends SqlParserError<"Unknown column in WHERE"> ? true : false>

type W3part = ParseWhereExpression<ParseSqlTokens<`public.users.id = 1`>, DbUsers, UsersScope>
type _w3part = Expect<W3part[1] extends null ? true : false>

type InnerScope = Record<
	"inner_t",
	{ schema: "public"; table: "inner_t"; columns: { a: number }; column_sql_types: { a: "integer" } }
>
type OuterScope = Record<
	"outer_t",
	{ schema: "public"; table: "outer_t"; columns: { b: string }; column_sql_types: { b: "text" } }
>

/** Caller merges scopes (e.g. enclosing + inner `FROM`) — `outer_t.b` resolves in the combined map. */
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>
type WTwoLayer = ParseWhereExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner>
type _wTwoLayer = Expect<WTwoLayer[1] extends null ? true : false>

type WAnd = ParseWhereExpression<ParseSqlTokens<`users.id = 1 and users.name is null`>, DbUsers, UsersScope>
type _wAnd = Expect<WAnd[1] extends null ? true : false>

/** Catalog three-part: missing table. */
type W3badTab = ParseWhereExpression<ParseSqlTokens<`public.nope.id = 1`>, DbUsers, UsersScope>
type _w3badTab = Expect<W3badTab[1] extends SqlParserError<"Unknown schema or table in WHERE"> ? true : false>

/** Catalog three-part: unknown schema. */
type W3badSch = ParseWhereExpression<ParseSqlTokens<`missing.users.id = 1`>, DbUsers, UsersScope>
type _w3badSch = Expect<W3badSch[1] extends SqlParserError<"Unknown schema or table in WHERE"> ? true : false>

/** Catalog three-part: known table, unknown column. */
type W3badCol = ParseWhereExpression<ParseSqlTokens<`public.users.nope = 1`>, DbUsers, UsersScope>
type _w3badCol = Expect<
	W3badCol[1] extends SqlParserError<"Unknown column (schema.table.column) in WHERE"> ? true : false
>

/** Two-part qualified: alias not in scope. */
type W2badAlias = ParseWhereExpression<ParseSqlTokens<`nope.id = 1`>, DbUsers, UsersScope>
type _w2badAlias = Expect<W2badAlias[1] extends SqlParserError<"Unknown qualified column in WHERE"> ? true : false>

/** RHS subexpression: missing closing `)`. */
type WUnbalRhs = ParseWhereExpression<ParseSqlTokens<`users.id = ( 1`>, DbUsers, UsersScope>
type _wUnbalRhs = Expect<WUnbalRhs[1] extends SqlParserError<"Unbalanced parentheses in WHERE"> ? true : false>

/** `IN` list: missing closing `)`. */
type WUnbalIn = ParseWhereExpression<ParseSqlTokens<`users.id in ( 1`>, DbUsers, UsersScope>
type _wUnbalIn = Expect<WUnbalIn[1] extends SqlParserError<"Unbalanced parentheses in WHERE IN"> ? true : false>

/** `IN` without `(`. */
type WInNoParen = ParseWhereExpression<ParseSqlTokens<`users.id in 1`>, DbUsers, UsersScope>
type _wInNoParen = Expect<WInNoParen[1] extends SqlParserError<"Expected `(` after IN in WHERE"> ? true : false>

/** `IS` must be followed by `NULL` (not arbitrary identifier). */
type WIsBad = ParseWhereExpression<ParseSqlTokens<`users.name is users`>, DbUsers, UsersScope>
type _wIsBad = Expect<WIsBad[1] extends SqlParserError<"Expected NULL after IS in WHERE"> ? true : false>

/** `IS NOT` must be followed by `NULL`. */
type WIsNotBad = ParseWhereExpression<ParseSqlTokens<`users.name is not true`>, DbUsers, UsersScope>
type _wIsNotBad = Expect<WIsNotBad[1] extends SqlParserError<"Expected NULL after IS NOT in WHERE"> ? true : false>

/** Grouped WHERE: inner ok but outer `)` missing. */
type WGrpNoClose = ParseWhereExpression<ParseSqlTokens<`( users.id = 1`>, DbUsers, UsersScope>
type _wGrpNoClose = Expect<WGrpNoClose[1] extends SqlParserError<"Expected `)` in WHERE"> ? true : false>

/** Operand position: token stream not a valid operand (e.g. lone `+`). */
type WUnexpectedRhs = ParseWhereExpression<ParseSqlTokens<`users.id = +`>, DbUsers, UsersScope>
type _wUnexpectedRhs = Expect<WUnexpectedRhs[1] extends SqlParserError<"Unexpected token in WHERE"> ? true : false>

/** `OR` second conjunct: bad column. */
type WOrBad = ParseWhereExpression<ParseSqlTokens<`users.id = 1 or users.nope = 2`>, DbUsers, UsersScope>
type _wOrBad = Expect<WOrBad[1] extends SqlParserError<"Unknown qualified column in WHERE"> ? true : false>

/** `AND` second conjunct: bad column. */
type WAndBad = ParseWhereExpression<ParseSqlTokens<`users.id = 1 and users.nope = 2`>, DbUsers, UsersScope>
type _wAndBad = Expect<WAndBad[1] extends SqlParserError<"Unknown qualified column in WHERE"> ? true : false>

/** Unary `NOT` then invalid column ref. */
type WNotBad = ParseWhereExpression<ParseSqlTokens<`not users.nope = 1`>, DbUsers, UsersScope>
type _wNotBad = Expect<WNotBad[1] extends SqlParserError<"Unknown qualified column in WHERE"> ? true : false>

/** Function-like call on RHS: unbalanced parens inside skipped region. */
type WFuncUnbal = ParseWhereExpression<ParseSqlTokens<`users.id = lower( 'x'`>, DbUsers, UsersScope>
type _wFuncUnbal = Expect<WFuncUnbal[1] extends SqlParserError<"Unbalanced parentheses in WHERE"> ? true : false>

/** Success: comparison operators and literals. */
type WNe = ParseWhereExpression<ParseSqlTokens<`users.id <> 1`>, DbUsers, UsersScope>
type _wNe = Expect<WNe[1] extends null ? true : false>
type WNeBang = ParseWhereExpression<ParseSqlTokens<`users.id != 1`>, DbUsers, UsersScope>
type _wNeBang = Expect<WNeBang[1] extends null ? true : false>
type WLe = ParseWhereExpression<ParseSqlTokens<`users.id <= 2`>, DbUsers, UsersScope>
type _wLe = Expect<WLe[1] extends null ? true : false>
type WStr = ParseWhereExpression<ParseSqlTokens<`users.name = 'a'`>, DbUsers, UsersScope>
type _wStr = Expect<WStr[1] extends null ? true : false>
type WBool = ParseWhereExpression<ParseSqlTokens<`users.id = true`>, DbUsers, UsersScope>
type _wBool = Expect<WBool[1] extends null ? true : false>
type WNullRhs = ParseWhereExpression<ParseSqlTokens<`users.id = null`>, DbUsers, UsersScope>
type _wNullRhs = Expect<WNullRhs[1] extends null ? true : false>

/** Success: `IS NOT NULL`, `IN (...)`, nested parens, `OR` inside parens. */
type WIsNotNull = ParseWhereExpression<ParseSqlTokens<`users.name is not null`>, DbUsers, UsersScope>
type _wIsNotNull = Expect<WIsNotNull[1] extends null ? true : false>
type WInList = ParseWhereExpression<ParseSqlTokens<`users.id in ( 1 , 2 )`>, DbUsers, UsersScope>
type _wInList = Expect<WInList[1] extends null ? true : false>
type WNested = ParseWhereExpression<ParseSqlTokens<`( ( users.id = 1 ) )`>, DbUsers, UsersScope>
type _wNested = Expect<WNested[1] extends null ? true : false>
type WOrInParens = ParseWhereExpression<
	ParseSqlTokens<`users.id = 1 and ( users.name = 'a' or users.name = 'b' )`>,
	DbUsers,
	UsersScope
>
type _wOrInParens = Expect<WOrInParens[1] extends null ? true : false>

type WNotNot = ParseWhereExpression<ParseSqlTokens<`not not users.id = 1`>, DbUsers, UsersScope>
type _wNotNot = Expect<WNotNot[1] extends null ? true : false>

/**
 * Bare-column ambiguity is decided with a literal `Col` in `ValidateWhereColumnParts`.
 * `ParseSqlTokens` widens bare identifiers to `string`, so full-parser ambiguity is not asserted here;
 * the helper below is the same predicate used for `"Ambiguous unqualified column in WHERE"`.
 */
type AmbigT1 = Record<
	"t1",
	{ schema: "public"; table: "t1"; columns: { id: string }; column_sql_types: { id: "uuid" } }
>
type AmbigT2 = Record<
	"t2",
	{ schema: "public"; table: "t2"; columns: { id: string }; column_sql_types: { id: "uuid" } }
>
type AmbigScope = AmbigT1 & AmbigT2
type _ambigHelper = Expect<HasAmbiguousUnqualifiedColumn<AmbigScope, "id"> extends true ? true : false>

describe("parse-where-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
