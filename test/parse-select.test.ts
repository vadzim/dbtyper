import { describe, it } from "node:test"
import type { JsqlSchemaShape, JsqlSelectStatementResult } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type {
	TText,
	TInteger,
	TBigint,
	TBoolean,
	TNumeric,
	TUuid,
	TTimestamp,
	TDate,
	TNull,
} from "./test-utils/sql-type-helpers.ts"
import type { ApplyStatements, ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { SqlDatabase } from "../src/core/sql-database.ts"

/**
 * `public` is default: `FROM users` resolves to `schemas.public.sets.users`.
 * `JOIN billing.subs AS billing_sub` uses an explicit schema for the right-hand table.
 */
type DbJoinDefaultAndExplicit = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create schema billing;
create table users ( id uuid not null, name text not null );
create table billing.subs ( id uuid not null, user_id uuid not null, plan_code text not null );
`
>[0]

type TJoinDefaultAndExplicit = ParseSqlStatement<
	ParseSqlTokens<`select users.id, billing_sub.plan_code from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>

type _joinResult = Expect<Extends<TJoinDefaultAndExplicit[2], JsqlSelectStatementResult>>
type _joinColumns = Expect<
	Extends<
		TJoinDefaultAndExplicit[2],
		{
			kind: "select"
			columns: { id: TUuid; plan_code: TText }
		}
	>
>

type TJoinBadColumn = ParseSqlStatement<
	ParseSqlTokens<`select users.id, billing_sub.wrong_col from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadCol = Expect<Extends<TJoinBadColumn[2], SqlParserError<string>>>

type TDistinct = ParseSqlStatement<ParseSqlTokens<`select distinct users.id from users;`>, DbJoinDefaultAndExplicit>
type _distinct = Expect<Extends<TDistinct[2], { kind: "select"; columns: { id: TUuid } }>>

type TSelectWhereOk = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users where users.name = 'a';`>,
	DbJoinDefaultAndExplicit
>
type _selectWhereOk = Expect<Extends<TSelectWhereOk[2], { kind: "select"; columns: { id: TUuid } }>>

type TSelectWhereBad = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users where users.nope = 'a';`>,
	DbJoinDefaultAndExplicit
>
type _selectWhereBad = Expect<Extends<TSelectWhereBad[2], SqlParserError<"Unknown qualified column">>>

type TSelectOrderByOk = ParseSqlStatement<
	ParseSqlTokens<`select users.name from users order by users.name;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderByOk = Expect<Extends<TSelectOrderByOk[2], JsqlSelectStatementResult>>

type TSelectOrderByBad = ParseSqlStatement<
	ParseSqlTokens<`select users.name from users order by users.nope;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderByBad = Expect<Extends<TSelectOrderByBad[2], SqlParserError<string>>>

type TSelectLimitOk = ParseSqlStatement<ParseSqlTokens<`select users.id from users limit 5;`>, DbJoinDefaultAndExplicit>
type _selectLimitOk = Expect<Extends<TSelectLimitOk[2], JsqlSelectStatementResult>>

/** `ORDER BY … DESC` / multi-column / comma ordering. */
type TSelectOrderByDesc = ParseSqlStatement<
	ParseSqlTokens<`select users.name from users order by users.name desc;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderByDesc = Expect<Extends<TSelectOrderByDesc[2], JsqlSelectStatementResult>>

type TSelectOrderByTwoCols = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users order by users.name asc, users.id desc;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderByTwoCols = Expect<Extends<TSelectOrderByTwoCols[2], JsqlSelectStatementResult>>

type TSelectOrderMissingBy = ParseSqlStatement<
	ParseSqlTokens<`select users.name from users order users.name;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderMissingBy = Expect<Extends<TSelectOrderMissingBy[2], SqlParserError<"Expected BY after ORDER">>>

/** `OFFSET` without `LIMIT` (PostgreSQL); `OFFSET … LIMIT …`; `FETCH FIRST|NEXT … ROW(S) ONLY`. */
type TSelectOffsetOnly = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users offset 10;`>,
	DbJoinDefaultAndExplicit
>
type _selectOffsetOnly = Expect<Extends<TSelectOffsetOnly[2], JsqlSelectStatementResult>>

type TSelectOffsetThenLimit = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users offset 5 limit 10;`>,
	DbJoinDefaultAndExplicit
>
type _selectOffsetThenLimit = Expect<Extends<TSelectOffsetThenLimit[2], JsqlSelectStatementResult>>

type TSelectFetchFirstRowsOnly = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users fetch first 5 rows only;`>,
	DbJoinDefaultAndExplicit
>
type _selectFetchFirstRowsOnly = Expect<Extends<TSelectFetchFirstRowsOnly[2], JsqlSelectStatementResult>>

type TSelectFetchNextRowOnly = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users fetch next 1 row only;`>,
	DbJoinDefaultAndExplicit
>
type _selectFetchNextRowOnly = Expect<Extends<TSelectFetchNextRowOnly[2], JsqlSelectStatementResult>>

type TSelectOrderByFetchFirst = ParseSqlStatement<
	ParseSqlTokens<`select users.name from users order by users.name fetch first 3 rows only;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrderByFetchFirst = Expect<Extends<TSelectOrderByFetchFirst[2], JsqlSelectStatementResult>>

type TSelectOffsetBadCol = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users offset users.nope;`>,
	DbJoinDefaultAndExplicit
>
type _selectOffsetBadCol = Expect<Extends<TSelectOffsetBadCol[2], SqlParserError<"Unknown qualified column">>>

type TSelectFetchBadCol = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users fetch first users.nope rows only;`>,
	DbJoinDefaultAndExplicit
>
type _selectFetchBadCol = Expect<Extends<TSelectFetchBadCol[2], SqlParserError<"Unknown qualified column">>>

type TSelectFetchMissingRowsKw = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users fetch first 5 only;`>,
	DbJoinDefaultAndExplicit
>
type _selectFetchMissingRowsKw = Expect<
	Extends<TSelectFetchMissingRowsKw[2], SqlParserError<"Expected ROW or ROWS in FETCH">>
>

/** `CASE` at list start (non-ident head) is accepted like other literals. */
type TSelectCaseKw = ParseSqlStatement<
	ParseSqlTokens<`select case when true then users.id else users.id end as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCaseKw = Expect<Extends<TSelectCaseKw[2], { kind: "select"; columns: { x: TUuid } }>>

/** Simple `CASE expr WHEN …` (distinct from searched `CASE WHEN boolean`). */
type TSelectCaseSimple = ParseSqlStatement<
	ParseSqlTokens<`select case users.id when '00000000-0000-0000-0000-000000000001'::uuid then users.name else users.name end as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCaseSimple = Expect<Extends<TSelectCaseSimple[2], { kind: "select"; columns: { x: TText } }>>
type TSelectCaseSimpleWhenMismatch = ParseSqlStatement<
	ParseSqlTokens<`select case users.id when 1 then users.name else users.name end as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCaseSimpleWhenMismatch = Expect<
	Extends<TSelectCaseSimpleWhenMismatch[2], SqlParserError<"Incompatible types in comparison">>
>
type TSelectCaseSimpleNoElse = ParseSqlStatement<
	ParseSqlTokens<`select case users.id when '00000000-0000-0000-0000-000000000001'::uuid then users.name end as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCaseSimpleNoElse = Expect<
	Extends<TSelectCaseSimpleNoElse[2], { kind: "select"; columns: { x: TNull<"text"> } }>
>

/** `WITH` CTE: inner `SELECT` merged into outer scope with base `FROM` tables. */
type TWithCte = ParseSqlStatement<
	ParseSqlTokens<`with c as (select users.id as uid from users) select c.uid from users;`>,
	DbJoinDefaultAndExplicit
>
type _withCte = Expect<Extends<TWithCte[2], { kind: "select"; columns: { uid: TUuid } }>>
type TWithDup = ParseSqlStatement<
	ParseSqlTokens<`with x as (select users.id from users), x as (select users.name as n from users) select x.id from users;`>,
	DbJoinDefaultAndExplicit
>
type _withDup = Expect<Extends<TWithDup[2], SqlParserError<"Duplicate WITH clause name">>>

/** Derived table: inner `SELECT` exposes columns under outer alias (`__subquery__` scope entry). */
type TDerivedTable = ParseSqlStatement<
	ParseSqlTokens<`select s.id from (select users.id from users) as s;`>,
	DbJoinDefaultAndExplicit
>
type _derivedTable = Expect<Extends<TDerivedTable[2], { kind: "select"; columns: { id: TUuid } }>>

type TDerivedJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join (select users.id as uid from users) t on users.id = t.uid;`>,
	DbJoinDefaultAndExplicit
>
type _derivedJoin = Expect<Extends<TDerivedJoin[2], { kind: "select"; columns: { id: TUuid } }>>

type TDerivedBadCol = ParseSqlStatement<
	ParseSqlTokens<`select s.nope from (select users.id from users) as s;`>,
	DbJoinDefaultAndExplicit
>
type _derivedBadCol = Expect<Extends<TDerivedBadCol[2], SqlParserError<string>>>

type TDerivedNoAlias = ParseSqlStatement<
	ParseSqlTokens<`select 1 from (select users.id as x from users);`>,
	DbJoinDefaultAndExplicit
>
type _derivedNoAlias = Expect<Extends<TDerivedNoAlias[2], SqlParserError<string>>>

/** Inner `WHERE` uses only inner `FROM` scope. */
type TDerivedInnerWhere = ParseSqlStatement<
	ParseSqlTokens<`select s.id from (select users.id from users where users.name = 'a') as s;`>,
	DbJoinDefaultAndExplicit
>
type _derivedInnerWhere = Expect<Extends<TDerivedInnerWhere[2], { kind: "select"; columns: { id: TUuid } }>>

type TDerivedInnerDistinct = ParseSqlStatement<
	ParseSqlTokens<`select s.id from (select distinct users.id from users) as s;`>,
	DbJoinDefaultAndExplicit
>
type _derivedInnerDistinct = Expect<Extends<TDerivedInnerDistinct[2], { kind: "select"; columns: { id: TUuid } }>>

/** Inner `JOIN` uses empty outer scope; only inner aliases/tables exist. */
type TDerivedInnerJoin = ParseSqlStatement<
	ParseSqlTokens<`select s.id from (select users.id from users join billing.subs as bs on users.id = bs.user_id) as s;`>,
	DbJoinDefaultAndExplicit
>
type _derivedInnerJoin = Expect<Extends<TDerivedInnerJoin[2], { kind: "select"; columns: { id: TUuid } }>>

/** Sole derived `FROM` item with bare table alias (no `AS`). */
type TDerivedBareAs = ParseSqlStatement<
	ParseSqlTokens<`select u.id from (select users.id from users) u;`>,
	DbJoinDefaultAndExplicit
>
type _derivedBareAs = Expect<Extends<TDerivedBareAs[2], JsqlSelectStatementResult>>

type TDerivedLeftOuterJoinRhs = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users left outer join (select users.id as uid from users) q on users.id = q.uid;`>,
	DbJoinDefaultAndExplicit
>
type _derivedLeftOuterJoinRhs = Expect<Extends<TDerivedLeftOuterJoinRhs[2], { kind: "select"; columns: { id: TUuid } }>>

type TDerivedBadOpen = ParseSqlStatement<ParseSqlTokens<`select 1 from ( from users ) as x;`>, DbJoinDefaultAndExplicit>
type _derivedBadOpen = Expect<Extends<TDerivedBadOpen[2], SqlParserError<"Expected SELECT in derived table">>>

// NOTE: SELECT without FROM is now supported, so this test is no longer valid
// /** Inner closes with `;` before `)` → `ReadClosingParenAndAliasDerived` sees `;`. */
// type TDerivedUnclosedParen = ParseSqlStatement<
// 	ParseSqlTokens<`select 1 from (select users.id from users as x;`>,
// 	DbJoinDefaultAndExplicit
// >
// type _derivedUnclosedParen = Expect<
// 	Extends<TDerivedUnclosedParen[2], SqlParserError<"Expected `)` after derived table">>
// >

// NOTE: SELECT without FROM is now supported, so this test is no longer valid
// type TDerivedNoInnerFrom = ParseSqlStatement<
// 	ParseSqlTokens<`select 1 from (select users.id) as x;`>,
// 	DbJoinDefaultAndExplicit
// >
// type _derivedNoInnerFrom = Expect<Extends<TDerivedNoInnerFrom[2], { kind: "select"; columns: { id: TUuid } }>>

type DerivedParamsRid = { rid: TUuid }
type TDerivedInnerParam = ParseSqlStatement<
	ParseSqlTokens<`select s.id from (select :rid as id from users) as s;`>,
	DbJoinDefaultAndExplicit,
	DerivedParamsRid
>
type _derivedInnerParamActual = TDerivedInnerParam[2]
type _derivedInnerParam = Expect<Extends<_derivedInnerParamActual, { kind: "select"; columns: { id: TUuid } }>>

/** Outer `FROM` alias must not leak into inner `SELECT` list scope. */
type TDerivedCorrInnerList = ParseSqlStatement<
	ParseSqlTokens<`select u.id from users as u join (select u.id from users) t on u.id = t.id;`>,
	DbJoinDefaultAndExplicit
>
type _derivedCorrInnerList = Expect<Extends<TDerivedCorrInnerList[2], SqlParserError<"Unknown qualified column">>>

/** Outer `FROM` alias must not appear in inner `WHERE` scope. */
type TDerivedCorrInnerWhere = ParseSqlStatement<
	ParseSqlTokens<`select u.id from users as u join (select users.id from users where users.id = u.id) t on u.id = t.id;`>,
	DbJoinDefaultAndExplicit
>
type _derivedCorrInnerWhere = Expect<Extends<TDerivedCorrInnerWhere[2], SqlParserError<"Unknown qualified column">>>

type TInnerJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users inner join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _innerJoin = Expect<Extends<TInnerJoin[2], JsqlSelectStatementResult>>

type TLeftJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users left join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _leftJoin = Expect<Extends<TLeftJoin[2], JsqlSelectStatementResult>>

type TChainedJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as s1 on users.id = s1.user_id join billing.subs as s2 on s1.plan_code = s2.plan_code;`>,
	DbJoinDefaultAndExplicit
>
type _chainedJoin = Expect<Extends<TChainedJoin[2], JsqlSelectStatementResult>>

type TSelectStar = ParseSqlStatement<ParseSqlTokens<`select * from users;`>, DbJoinDefaultAndExplicit>
type _selectStar = Expect<Extends<TSelectStar[2], { kind: "select"; columns: { id: TUuid; name: TText } }>>

type TCatalogQualColumnSelect = ParseSqlStatement<
	ParseSqlTokens<`select public.users.id from users;`>,
	DbJoinDefaultAndExplicit
>
type _catalogQualColumnSelect = Expect<Extends<TCatalogQualColumnSelect[2], { kind: "select"; columns: { id: TUuid } }>>

type TAsAlias = ParseSqlStatement<ParseSqlTokens<`select users.id as uid from users;`>, DbJoinDefaultAndExplicit>
type _asAlias = Expect<Extends<TAsAlias[2], { kind: "select"; columns: { uid: TUuid } }>>

type TScalarAdd = ParseSqlStatement<ParseSqlTokens<`select 1 + 1 as a from users;`>, DbJoinDefaultAndExplicit>
type _scalarAdd = Expect<Extends<TScalarAdd[2], { kind: "select"; columns: { a: TInteger } }>>

/** `users` row_count is numeric so `+ 1` is valid arithmetic after resolve. */
type DbJoinWithRowCount = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: TUuid; name: TText; row_count: TInteger }
				}
			}
		}
		billing: DbJoinDefaultAndExplicit["schemas"]["billing"]
	}
}

type TColPlusOne = ParseSqlStatement<ParseSqlTokens<`select users.row_count + 1 as x from users;`>, DbJoinWithRowCount>
type _colPlusOne = Expect<Extends<TColPlusOne[2], { kind: "select"; columns: { x: TInteger } }>>

/** Sole projection without `AS` uses PostgreSQL-style `?column?` (not bare `col` AST). */
type TColPlusOneNoAs = ParseSqlStatement<ParseSqlTokens<`select users.row_count + 1 from users;`>, DbJoinWithRowCount>
type _colPlusOneNoAs = Expect<Extends<TColPlusOneNoAs[2], { kind: "select"; columns: { "?column?": TInteger } }>>

type TSelectLiteralOne = ParseSqlStatement<ParseSqlTokens<`select 1 from users;`>, DbJoinWithRowCount>
type _selectLiteralOne = Expect<Extends<TSelectLiteralOne[2], { kind: "select"; columns: { "?column?": TInteger } }>>

type TSelectTwoUnnamed = ParseSqlStatement<ParseSqlTokens<`select 1, 2 from users;`>, DbJoinWithRowCount>
type _selectTwoUnnamed = Expect<
	Extends<TSelectTwoUnnamed[2], SqlParserError<"Scalar expression in SELECT requires AS alias">>
>

type TBadColInExpr = ParseSqlStatement<ParseSqlTokens<`select users.nope + 1 as x from users;`>, DbJoinWithRowCount>
type _badColInExpr = Expect<Extends<TBadColInExpr[2], SqlParserError<string>>>

/** `:name` in the projection list must appear in the statement `Params` map (default empty params errors). */
type SelectParamsLimit = { limit: TInteger }
type TSelectParam = ParseSqlStatement<
	ParseSqlTokens<`select :limit, users.id from users;`>,
	DbJoinDefaultAndExplicit,
	SelectParamsLimit
>
type _selectParam = Expect<
	Extends<
		TSelectParam[2],
		{
			kind: "select"
			columns: { limit: TInteger; id: TUuid }
		}
	>
>

type TSelectParamAs = ParseSqlStatement<
	ParseSqlTokens<`select :pagesize as page_size, users.name from users;`>,
	DbJoinDefaultAndExplicit,
	{ pagesize: TInteger }
>
type _selectParamAs = Expect<
	Extends<
		TSelectParamAs[2],
		{
			kind: "select"
			columns: { page_size: TInteger; name: TText }
		}
	>
>

type TUnknownFrom = ParseSqlStatement<ParseSqlTokens<`select users.id from ghost_table;`>, DbJoinDefaultAndExplicit>
type _unknownFrom = Expect<Extends<TUnknownFrom[2], SqlParserError<string>>>

type TJoinBadOnRight = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.id = billing_sub.not_a_column;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnRight = Expect<Extends<TJoinBadOnRight[2], SqlParserError<string>>>

type TJoinBadOnLeft = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.not_a_column = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnLeft = Expect<Extends<TJoinBadOnLeft[2], SqlParserError<string>>>

type TStarPlusComma = ParseSqlStatement<ParseSqlTokens<`select *, users.id from users;`>, DbJoinDefaultAndExplicit>
type _starPlusComma = Expect<
	Extends<TStarPlusComma[2], SqlParserError<"SELECT * must be the only projection in the list">>
>

// NOTE: SELECT without FROM is now supported, so this test is no longer valid
// type TMissingFrom = ParseSqlStatement<ParseSqlTokens<`select users.id , users.name`>, DbJoinDefaultAndExplicit>
// type _missingFrom = Expect<Extends<TMissingFrom[2], SqlParserError<"Unknown column">>>

/** `name` exists only on `users`; unqualified is valid with a join (Postgres-like uniqueness). */
type TUnqualNameUnambiguous = ParseSqlStatement<
	ParseSqlTokens<`select name from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualNameOk = Expect<Extends<TUnqualNameUnambiguous[2], { kind: "select"; columns: { name: TText } }>>

/** `id` exists on both `users` and `subs` → ambiguous bare reference. */
type TUnqualIdAmbiguous = ParseSqlStatement<
	ParseSqlTokens<`select id from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualIdAmbiguous = Expect<Extends<TUnqualIdAmbiguous[2], SqlParserError<"Ambiguous unqualified column">>>

type TUnqualGhostUnknown = ParseSqlStatement<
	ParseSqlTokens<`select ghost from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualGhostUnknown = Expect<Extends<TUnqualGhostUnknown[2], SqlParserError<"Unknown column">>>

/** Boolean expression in the projection (extends {@link ScalarExprAst} parse/resolve, not `ParseBooleanExpression`). */
type TSelectBoolCmpAnd = ParseSqlStatement<
	ParseSqlTokens<`select ((2 > 0) and (1 < 3)) as ok from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectBoolCmpAnd = Expect<Extends<TSelectBoolCmpAnd[2], { kind: "select"; columns: { ok: TBoolean } }>>

type TSelectBoolOrAndPrec = ParseSqlStatement<
	ParseSqlTokens<`select true or false and false as p from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectBoolOrAndPrec = Expect<Extends<TSelectBoolOrAndPrec[2], { kind: "select"; columns: { p: TBoolean } }>>

type TSelectNotFalse = ParseSqlStatement<ParseSqlTokens<`select not false as x from users;`>, DbJoinDefaultAndExplicit>
type _selectNotFalse = Expect<Extends<TSelectNotFalse[2], { kind: "select"; columns: { x: TBoolean } }>>

type TSelectCmpAdd = ParseSqlStatement<ParseSqlTokens<`select 1 + 2 > 2 as gt from users;`>, DbJoinDefaultAndExplicit>
type _selectCmpAdd = Expect<Extends<TSelectCmpAdd[2], { kind: "select"; columns: { gt: TBoolean } }>>

type TSelectIsNull = ParseSqlStatement<
	ParseSqlTokens<`select (users.name is null) as n from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectIsNull = Expect<Extends<TSelectIsNull[2], { kind: "select"; columns: { n: TBoolean } }>>

type TSelectInList = ParseSqlStatement<
	ParseSqlTokens<`select (users.id in ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid)) as inside from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectInList = Expect<Extends<TSelectInList[2], { kind: "select"; columns: { inside: TBoolean } }>>

type TSelectInListTypeErr = ParseSqlStatement<
	ParseSqlTokens<`select (users.id in (1, 2, 3)) as inside from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectInListTypeErr = Expect<Extends<TSelectInListTypeErr[2], SqlParserError<"Incompatible types in IN list">>>

type TSelectNotNumberErr = ParseSqlStatement<ParseSqlTokens<`select not 1 as x from users;`>, DbJoinDefaultAndExplicit>
type _selectNotNumberErr = Expect<Extends<TSelectNotNumberErr[2], SqlParserError<"NOT requires a boolean operand">>>

type TSelectAndNonBoolErr = ParseSqlStatement<
	ParseSqlTokens<`select (5 and true) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectAndNonBoolErr = Expect<Extends<TSelectAndNonBoolErr[2], SqlParserError<"AND operands must be boolean">>>

type TSelectCmpTypeErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 = true) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCmpTypeErr = Expect<Extends<TSelectCmpTypeErr[2], SqlParserError<"Incompatible types in comparison">>>

type TSelectCmpStrNumErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 > 'a') as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCmpStrNumErr = Expect<Extends<TSelectCmpStrNumErr[2], SqlParserError<"Incompatible types in comparison">>>

type TSelectEqNullErr = ParseSqlStatement<
	ParseSqlTokens<`select (null = null) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectEqNullErr = Expect<Extends<TSelectEqNullErr[2], SqlParserError<"Use IS NULL instead of = null">>>

type TSelectIsBadRhsErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 is 2) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectIsBadRhsErr = Expect<Extends<TSelectIsBadRhsErr[2], SqlParserError<"Expected NULL after IS">>>

type TSelectInNoParenErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 in 1) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectInNoParenErr = Expect<Extends<TSelectInNoParenErr[2], SqlParserError<"Expected `(` after IN">>>

type TSelectOrNonBoolErr = ParseSqlStatement<
	ParseSqlTokens<`select (true or 1) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrNonBoolErr = Expect<Extends<TSelectOrNonBoolErr[2], SqlParserError<"OR operands must be boolean">>>

type TSelectNullAndErr = ParseSqlStatement<
	ParseSqlTokens<`select (true and null) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectNullAndErr = Expect<
	Extends<TSelectNullAndErr[2], SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">>
>

type TSelectNotNullErr = ParseSqlStatement<ParseSqlTokens<`select not null as x from users;`>, DbJoinDefaultAndExplicit>
type _selectNotNullErr = Expect<Extends<TSelectNotNullErr[2], SqlParserError<"NOT argument must be boolean, not NULL">>>

type TSelectPgCast = ParseSqlStatement<
	ParseSqlTokens<`select 42::text as t, (1 + 2)::bigint as b from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectPgCast = Expect<Extends<TSelectPgCast[2], { kind: "select"; columns: { t: TText; b: TBigint } }>>

type TSelectSqlCast = ParseSqlStatement<
	ParseSqlTokens<`select cast(true as text) as flag_txt from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectSqlCast = Expect<Extends<TSelectSqlCast[2], { kind: "select"; columns: { flag_txt: TText } }>>

type TSelectCastIntErr = ParseSqlStatement<
	ParseSqlTokens<`select cast('x' as integer) as bad from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCastIntErr = Expect<Extends<TSelectCastIntErr[2], { kind: "select"; columns: { bad: TInteger } }>>

type TSelectPgCastBoolIntErr = ParseSqlStatement<
	ParseSqlTokens<`select false::integer as bad from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectPgCastBoolIntErr = Expect<
	Extends<TSelectPgCastBoolIntErr[2], { kind: "select"; columns: { bad: TInteger } }>
>

/** Two **`WITH`** CTEs (parser must accept a comma-separated CTE list before the main **`SELECT`**). */
type TWithTwoCtes = ParseSqlStatement<
	ParseSqlTokens<`
with
  a as (select users.id as uid from users),
  b as (select users.name as n from users)
select users.id from users;
`>,
	DbJoinDefaultAndExplicit
>
type _withTwoCtes = Expect<Extends<TWithTwoCtes[2], { kind: "select"; columns: { id: TUuid } }>>

type DbCrossJoin = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create table users ( id text, name text );
create table roles ( id text, role_name text );
`
>[0]

type TCrossJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.name, roles.role_name from users cross join roles;`>,
	DbCrossJoin
>

type _crossJoinResult = Expect<Extends<TCrossJoin[2], JsqlSelectStatementResult>>
type _crossJoinColumns = Expect<
	Extends<
		TCrossJoin[2],
		{
			kind: "select"
			columns: {
				name: TNull<"text">
				role_name: TNull<"text">
			}
		}
	>
>

type TCrossJoinMultiple = ParseSqlStatement<
	ParseSqlTokens<`select u.name, r.role_name from users u cross join roles r cross join users u2;`>,
	DbCrossJoin
>

type _crossJoinMultiple = Expect<Extends<TCrossJoinMultiple[2], JsqlSelectStatementResult>>

type DbSubqueries = ApplyStatements<
	SqlDatabase,
	`
create schema public;
create table users ( id text, name text );
create table posts ( id text, user_id text, title text );
`
>[0]

type TSubqueryInWhere = ParseSqlStatement<
	ParseSqlTokens<`select * from users where id in (select user_id from posts);`>,
	DbSubqueries
>

type _subqueryInWhereResult = Expect<Extends<TSubqueryInWhere[2], JsqlSelectStatementResult>>
type _subqueryInWhereColumns = Expect<
	Extends<
		TSubqueryInWhere[2],
		{
			kind: "select"
			columns: {
				id: TNull<"text">
				name: TNull<"text">
			}
		}
	>
>

type TExistsSubquery = ParseSqlStatement<
	ParseSqlTokens<`select * from users where exists (select 1 from posts where posts.user_id = users.id);`>,
	DbSubqueries
>

type _existsSubqueryResult = Expect<Extends<TExistsSubquery[2], JsqlSelectStatementResult>>
type _existsSubqueryColumns = Expect<
	Extends<
		TExistsSubquery[2],
		{
			kind: "select"
			columns: {
				id: TNull<"text">
				name: TNull<"text">
			}
		}
	>
>

describe("parse-select (type tests)", () => {
	it("compile-time assertions above", () => {})
})
