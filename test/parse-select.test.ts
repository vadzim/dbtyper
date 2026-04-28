import { describe, it } from "node:test"
import type { JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect } from "./test-utils/type-test-utils.ts"
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

type _joinResult = Expect<TJoinDefaultAndExplicit[2] extends JsqlSelectStatementResult ? true : false>
type _joinColumns = Expect<
	TJoinDefaultAndExplicit[2] extends {
		kind: "select"
		columns: { id: string; plan_code: string }
		column_sql_types: { id: "uuid"; plan_code: "text" }
	}
		? true
		: false
>

type TJoinBadColumn = ParseSqlStatement<
	ParseSqlTokens<`select users.id, billing_sub.wrong_col from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadCol = Expect<TJoinBadColumn[2] extends SqlParserError<string> ? true : false>

type TDistinct = ParseSqlStatement<ParseSqlTokens<`select distinct users.id from users;`>, DbJoinDefaultAndExplicit>
type _distinct = Expect<
	TDistinct[2] extends { kind: "select"; columns: { id: string }; column_sql_types: { id: "uuid" } } ? true : false
>

type TInnerJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users inner join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _innerJoin = Expect<TInnerJoin[2] extends JsqlSelectStatementResult ? true : false>

type TLeftJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users left join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _leftJoin = Expect<TLeftJoin[2] extends JsqlSelectStatementResult ? true : false>

type TChainedJoin = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as s1 on users.id = s1.user_id join billing.subs as s2 on s1.plan_code = s2.plan_code;`>,
	DbJoinDefaultAndExplicit
>
type _chainedJoin = Expect<TChainedJoin[2] extends JsqlSelectStatementResult ? true : false>

type TSelectStar = ParseSqlStatement<ParseSqlTokens<`select * from users;`>, DbJoinDefaultAndExplicit>
type _selectStar = Expect<
	TSelectStar[2] extends { kind: "select"; columns: { id: string; name: string } } ? true : false
>

type TThreePartCol = ParseSqlStatement<ParseSqlTokens<`select public.users.id from users;`>, DbJoinDefaultAndExplicit>
type _threePart = Expect<TThreePartCol[2] extends { kind: "select"; columns: { id: string } } ? true : false>

type TAsAlias = ParseSqlStatement<ParseSqlTokens<`select users.id as uid from users;`>, DbJoinDefaultAndExplicit>
type _asAlias = Expect<TAsAlias[2] extends { kind: "select"; columns: { uid: string } } ? true : false>

/** `:name` host parameters in the projection list (`TokenParam` from the lexer). */
type TSelectParam = ParseSqlStatement<ParseSqlTokens<`select :limit, users.id from users;`>, DbJoinDefaultAndExplicit>
type _selectParam = Expect<
	TSelectParam[2] extends {
		kind: "select"
		columns: { limit: unknown; id: string }
		column_sql_types: { limit: "unknown"; id: "uuid" }
	}
		? true
		: false
>

type TSelectParamAs = ParseSqlStatement<
	ParseSqlTokens<`select :pagesize as page_size, users.name from users;`>,
	DbJoinDefaultAndExplicit
>
type _selectParamAs = Expect<
	TSelectParamAs[2] extends {
		kind: "select"
		columns: { page_size: unknown; name: string }
		column_sql_types: { page_size: "unknown"; name: "text" }
	}
		? true
		: false
>

type TUnknownFrom = ParseSqlStatement<ParseSqlTokens<`select users.id from ghost_table;`>, DbJoinDefaultAndExplicit>
type _unknownFrom = Expect<TUnknownFrom[2] extends SqlParserError<string> ? true : false>

type TJoinBadOnRight = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.id = billing_sub.not_a_column;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnRight = Expect<TJoinBadOnRight[2] extends SqlParserError<string> ? true : false>

type TJoinBadOnLeft = ParseSqlStatement<
	ParseSqlTokens<`select users.id from users join billing.subs as billing_sub on users.not_a_column = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _joinBadOnLeft = Expect<TJoinBadOnLeft[2] extends SqlParserError<string> ? true : false>

type TStarPlusComma = ParseSqlStatement<ParseSqlTokens<`select *, users.id from users;`>, DbJoinDefaultAndExplicit>
type _starPlusComma = Expect<
	TStarPlusComma[2] extends SqlParserError<"SELECT * must be the only projection in the list"> ? true : false
>

type TMissingFrom = ParseSqlStatement<ParseSqlTokens<`select users.id , users.name`>, DbJoinDefaultAndExplicit>
type _missingFrom = Expect<TMissingFrom[2] extends SqlParserError<"Expected FROM after SELECT list"> ? true : false>

/** `name` exists only on `users`; unqualified is valid with a join (Postgres-like uniqueness). */
type TUnqualNameUnambiguous = ParseSqlStatement<
	ParseSqlTokens<`select name from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualNameOk = Expect<
	TUnqualNameUnambiguous[2] extends { kind: "select"; columns: { name: string }; column_sql_types: { name: "text" } }
		? true
		: false
>

/** `id` exists on both `users` and `subs` → ambiguous bare reference. */
type TUnqualIdAmbiguous = ParseSqlStatement<
	ParseSqlTokens<`select id from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualIdAmbiguous = Expect<
	TUnqualIdAmbiguous[2] extends SqlParserError<"Ambiguous unqualified column in SELECT"> ? true : false
>

type TUnqualGhostUnknown = ParseSqlStatement<
	ParseSqlTokens<`select ghost from users join billing.subs as billing_sub on users.id = billing_sub.user_id;`>,
	DbJoinDefaultAndExplicit
>
type _unqualGhostUnknown = Expect<
	TUnqualGhostUnknown[2] extends SqlParserError<"Unknown unqualified column in SELECT"> ? true : false
>

describe("parse-select (type tests)", () => {
	it("compile-time assertions above", () => {})
})
