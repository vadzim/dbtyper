import { describe, it } from "node:test"
import type { JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"

/**
 * `public` is default: `FROM users` resolves to `schemas.public.sets.users`.
 * `JOIN billing.subs AS billing_sub` uses an explicit schema for the right-hand table.
 */
type DbJoinDefaultAndExplicit = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string }
					column_sql_types: { id: "uuid"; name: "text" }
				}
			}
		}
		billing: JsqlSchemaShape & {
			sets: {
				subs: {
					kind: "table"
					columns: { id: string; user_id: string; plan_code: string }
					column_sql_types: { id: "uuid"; user_id: "uuid"; plan_code: "text" }
				}
			}
		}
	}
}

type TJoinDefaultAndExplicit = ParseSqlStatement<
	ParseSqlTokens<`select users.id, billing_sub.plan_code from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>

type _joinResult = Expect<Extends<Tuple3At2<TJoinDefaultAndExplicit>, JsqlSelectStatementResult>>
type _joinColumns = Expect<
	Extends<
		Tuple3At2<TJoinDefaultAndExplicit>,
		{
			kind: "select"
			columns: { id: string; plan_code: string }
			column_sql_types: { id: "uuid"; plan_code: "text" }
		}
	>
>

type TJoinBadColumn = ParseSqlStatement<
	ParseSqlTokens<`select users.id, billing_sub.wrong_col from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadCol = Expect<Extends<Tuple3At2<TJoinBadColumn>, SqlParserError<string>>>

type TDistinct = ParseSqlStatement<ParseSqlTokens<`select distinct users.id from users;`>, DbJoinDefaultAndExplicit>
type _distinct = Expect<
	Extends<Tuple3At2<TDistinct>, { kind: "select"; columns: { id: string }; column_sql_types: { id: "uuid" } }>
>

type TInnerJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users inner join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _innerJoin = Expect<Extends<Tuple3At2<TInnerJoin>, JsqlSelectStatementResult>>

type TLeftJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users left join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _leftJoin = Expect<Extends<Tuple3At2<TLeftJoin>, JsqlSelectStatementResult>>

type TChainedJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as s1 on users.id = s1.user_id join billing.subs as s2 on s1.plan_code = s2.plan_code;`>,
	DbJoinDefaultAndExplicit
>
type _chainedJoin = Expect<Extends<Tuple3At2<TChainedJoin>, JsqlSelectStatementResult>>

type TSelectStar = ParseSqlStatement<ParseSqlTokens<`select * from users;`>, DbJoinDefaultAndExplicit>
type _selectStar = Expect<Extends<Tuple3At2<TSelectStar>, { kind: "select"; columns: { id: string; name: string } }>>

type TThreePartCol = ParseSqlStatement<ParseSqlTokens<`select public.users.id from users;`>, DbJoinDefaultAndExplicit>
type _threePart = Expect<Extends<Tuple3At2<TThreePartCol>, { kind: "select"; columns: { id: string } }>>

type TAsAlias = ParseSqlStatement<ParseSqlTokens<`select users.id as uid from users;`>, DbJoinDefaultAndExplicit>
type _asAlias = Expect<Extends<Tuple3At2<TAsAlias>, { kind: "select"; columns: { uid: string } }>>

type TScalarAdd = ParseSqlStatement<ParseSqlTokens<`select 1 + 1 as a from users;`>, DbJoinDefaultAndExplicit>
type _scalarAdd = Expect<
	Extends<Tuple3At2<TScalarAdd>, { kind: "select"; columns: { a: number }; column_sql_types: { a: "number" } }>
>

/** `users` row_count is numeric so `+ 1` is valid arithmetic after resolve. */
type DbJoinWithRowCount = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: string; name: string; row_count: number }
					column_sql_types: { id: "uuid"; name: "text"; row_count: "integer" }
				}
			}
		}
		billing: DbJoinDefaultAndExplicit["schemas"]["billing"]
	}
}

type TColPlusOne = ParseSqlStatement<ParseSqlTokens<`select users.row_count + 1 as x from users;`>, DbJoinWithRowCount>
type _colPlusOne = Expect<Extends<Tuple3At2<TColPlusOne>, { kind: "select"; columns: { x: number } }>>

type TColPlusOneNoAs = ParseSqlStatement<ParseSqlTokens<`select users.row_count + 1 from users;`>, DbJoinWithRowCount>
type _colPlusOneNoAs = Expect<
	Extends<Tuple3At2<TColPlusOneNoAs>, SqlParserError<"Scalar expression in SELECT requires AS alias">>
>

type TBadColInExpr = ParseSqlStatement<ParseSqlTokens<`select users.nope + 1 as x from users;`>, DbJoinWithRowCount>
type _badColInExpr = Expect<Extends<Tuple3At2<TBadColInExpr>, SqlParserError<string>>>

/** `:name` in the projection list must appear in the statement `Params` map (default empty params errors). */
type SelectParamsLimit = { limit: { ts: number; sql: "integer" } }
type TSelectParam = ParseSqlStatement<
	ParseSqlTokens<`select :limit, users.id from users;`>,
	DbJoinDefaultAndExplicit,
	SelectParamsLimit
>
type _selectParam = Expect<
	Extends<
		Tuple3At2<TSelectParam>,
		{
			kind: "select"
			columns: { limit: number; id: string }
			column_sql_types: { limit: "integer"; id: "uuid" }
		}
	>
>

type TSelectParamAs = ParseSqlStatement<
	ParseSqlTokens<`select :pagesize as page_size, users.name from users;`>,
	DbJoinDefaultAndExplicit,
	{ pagesize: { ts: number; sql: "integer" } }
>
type _selectParamAs = Expect<
	Extends<
		Tuple3At2<TSelectParamAs>,
		{
			kind: "select"
			columns: { page_size: number; name: string }
			column_sql_types: { page_size: "integer"; name: "text" }
		}
	>
>

type TUnknownFrom = ParseSqlStatement<ParseSqlTokens<`select users.id from ghost_table;`>, DbJoinDefaultAndExplicit>
type _unknownFrom = Expect<Extends<Tuple3At2<TUnknownFrom>, SqlParserError<string>>>

type TJoinBadOnRight = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.id = billing_sub.not_a_column;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnRight = Expect<Extends<Tuple3At2<TJoinBadOnRight>, SqlParserError<string>>>

type TJoinBadOnLeft = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.not_a_column = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnLeft = Expect<Extends<Tuple3At2<TJoinBadOnLeft>, SqlParserError<string>>>

type TStarPlusComma = ParseSqlStatement<ParseSqlTokens<`select *, users.id from users;`>, DbJoinDefaultAndExplicit>
type _starPlusComma = Expect<
	Extends<Tuple3At2<TStarPlusComma>, SqlParserError<"SELECT * must be the only projection in the list">>
>

type TMissingFrom = ParseSqlStatement<ParseSqlTokens<`select users.id , users.name`>, DbJoinDefaultAndExplicit>
type _missingFrom = Expect<Extends<Tuple3At2<TMissingFrom>, SqlParserError<"Expected FROM after SELECT list">>>

/** `name` exists only on `users`; unqualified is valid with a join (Postgres-like uniqueness). */
type TUnqualNameUnambiguous = ParseSqlStatement<
	ParseSqlTokens<`select name from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualNameOk = Expect<
	Extends<
		Tuple3At2<TUnqualNameUnambiguous>,
		{ kind: "select"; columns: { name: string }; column_sql_types: { name: "text" } }
	>
>

/** `id` exists on both `users` and `subs` → ambiguous bare reference. */
type TUnqualIdAmbiguous = ParseSqlStatement<
	ParseSqlTokens<`select id from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualIdAmbiguous = Expect<Extends<Tuple3At2<TUnqualIdAmbiguous>, SqlParserError<"Ambiguous unqualified column">>>

type TUnqualGhostUnknown = ParseSqlStatement<
	ParseSqlTokens<`select ghost from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualGhostUnknown = Expect<Extends<Tuple3At2<TUnqualGhostUnknown>, SqlParserError<"Unknown column">>>

/** Boolean expression in the projection (extends {@link ScalarExprAst} parse/resolve, not `ParseBooleanExpression`). */
type TSelectBoolCmpAnd = ParseSqlStatement<
	ParseSqlTokens<`select ((2 > 0) and (1 < 3)) as ok from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectBoolCmpAnd = Expect<
	Extends<
		Tuple3At2<TSelectBoolCmpAnd>,
		{ kind: "select"; columns: { ok: boolean }; column_sql_types: { ok: "boolean" } }
	>
>

type TSelectBoolOrAndPrec = ParseSqlStatement<
	ParseSqlTokens<`select true or false and false as p from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectBoolOrAndPrec = Expect<
	Extends<Tuple3At2<TSelectBoolOrAndPrec>, { kind: "select"; columns: { p: boolean }; column_sql_types: { p: "boolean" } }>
>

type TSelectNotFalse = ParseSqlStatement<
	ParseSqlTokens<`select not false as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectNotFalse = Expect<
	Extends<Tuple3At2<TSelectNotFalse>, { kind: "select"; columns: { x: boolean }; column_sql_types: { x: "boolean" } }>
>

type TSelectCmpAdd = ParseSqlStatement<
	ParseSqlTokens<`select 1 + 2 > 2 as gt from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCmpAdd = Expect<
	Extends<Tuple3At2<TSelectCmpAdd>, { kind: "select"; columns: { gt: boolean }; column_sql_types: { gt: "boolean" } }>
>

type TSelectIsNull = ParseSqlStatement<
	ParseSqlTokens<`select (users.name is null) as n from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectIsNull = Expect<
	Extends<Tuple3At2<TSelectIsNull>, { kind: "select"; columns: { n: boolean }; column_sql_types: { n: "boolean" } }>
>

type TSelectInList = ParseSqlStatement<
	ParseSqlTokens<`select (users.id in (1, 2, 3)) as inside from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectInList = Expect<
	Extends<Tuple3At2<TSelectInList>, { kind: "select"; columns: { inside: boolean }; column_sql_types: { inside: "boolean" } }>
>

type TSelectNotNumberErr = ParseSqlStatement<
	ParseSqlTokens<`select not 1 as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectNotNumberErr = Expect<Extends<Tuple3At2<TSelectNotNumberErr>, SqlParserError<"NOT requires a boolean operand">>>

type TSelectAndNonBoolErr = ParseSqlStatement<
	ParseSqlTokens<`select (5 and true) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectAndNonBoolErr = Expect<Extends<Tuple3At2<TSelectAndNonBoolErr>, SqlParserError<"AND operands must be boolean">>>

type TSelectCmpTypeErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 = true) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCmpTypeErr = Expect<Extends<Tuple3At2<TSelectCmpTypeErr>, SqlParserError<"Incompatible types in comparison">>>

type TSelectCmpStrNumErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 > 'a') as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectCmpStrNumErr = Expect<Extends<Tuple3At2<TSelectCmpStrNumErr>, SqlParserError<"Incompatible types in comparison">>>

type TSelectEqNullErr = ParseSqlStatement<
	ParseSqlTokens<`select (null = null) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectEqNullErr = Expect<Extends<Tuple3At2<TSelectEqNullErr>, SqlParserError<"Use IS NULL instead of = null">>>

type TSelectIsBadRhsErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 is 2) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectIsBadRhsErr = Expect<Extends<Tuple3At2<TSelectIsBadRhsErr>, SqlParserError<"Expected NULL after IS">>>

type TSelectInNoParenErr = ParseSqlStatement<
	ParseSqlTokens<`select (1 in 1) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectInNoParenErr = Expect<Extends<Tuple3At2<TSelectInNoParenErr>, SqlParserError<"Expected `(` after IN">>>

type TSelectOrNonBoolErr = ParseSqlStatement<
	ParseSqlTokens<`select (true or 1) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectOrNonBoolErr = Expect<Extends<Tuple3At2<TSelectOrNonBoolErr>, SqlParserError<"OR operands must be boolean">>>

type TSelectNullAndErr = ParseSqlStatement<
	ParseSqlTokens<`select (true and null) as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectNullAndErr = Expect<Extends<Tuple3At2<TSelectNullAndErr>, SqlParserError<"NULL is not a valid boolean operand (use IS NULL)">>>

type TSelectNotNullErr = ParseSqlStatement<
	ParseSqlTokens<`select not null as x from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectNotNullErr = Expect<Extends<Tuple3At2<TSelectNotNullErr>, SqlParserError<"NOT argument must be boolean, not NULL">>>

describe("parse-select (type tests)", () => {
	it("compile-time assertions above", () => {})
})
