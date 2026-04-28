import { describe, it } from "node:test"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect } from "./test-utils/type-test-utils.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type { ExpressionParseContext, ParseExpression } from "../src/parser/parse-expression.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"

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

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: string; name: string }
	column_sql_types: { id: "uuid"; name: "text" }
}

type UsersScope = Record<"users", UsersEntry>

type WhereCtxEmpty = ExpressionParseContext<"three_part", {}>

type WUnknownParam = ParseWhereExpression<ParseSqlTokens<`:n = 'x'`>, DbUsers, UsersScope, {}>
type _wUnknownParam = Expect<WUnknownParam[1] extends SqlParserError<"Unknown query parameter"> ? true : false>

type WParamUnknownTs = ParseWhereExpression<
	ParseSqlTokens<`:p = 'x'`>,
	DbUsers,
	UsersScope,
	{ p: { ts: unknown; sql: "text" } }
>
type _wParamUnknownTs = Expect<WParamUnknownTs[1] extends SqlParserError<"Parameter has unknown type"> ? true : false>

type WParamBoolOk = ParseWhereExpression<
	ParseSqlTokens<`:flag`>,
	DbUsers,
	UsersScope,
	{ flag: { ts: true; sql: "boolean" } }
>
type _wParamBoolOk = Expect<WParamBoolOk[1] extends null ? true : false>

type WNonBoolRoot = ParseWhereExpression<ParseSqlTokens<`users.id`>, DbUsers, UsersScope>
type _wNonBoolRoot = Expect<WNonBoolRoot[1] extends SqlParserError<"Expression must be boolean"> ? true : false>

type ExprSelectCtx = ExpressionParseContext<"three_part", {}>

type SelBareCol = ParseExpression<ParseSqlTokens<`users.id`>, DbUsers, UsersScope, ExprSelectCtx>
type _selBareCol = Expect<SelBareCol[1] extends SqlParserError<"Expression must be boolean"> ? true : false>

type TSelectParamNoBind = ParseSqlStatement<ParseSqlTokens<`select :limit, users.id from users;`>, DbUsers>
type _selectParamNoBind = Expect<TSelectParamNoBind[2] extends SqlParserError<"Unknown query parameter"> ? true : false>

type InnerScope = Record<
	"inner_t",
	{ schema: "public"; table: "inner_t"; columns: { a: number }; column_sql_types: { a: "integer" } }
>
type OuterScope = Record<
	"outer_t",
	{ schema: "public"; table: "outer_t"; columns: { b: string }; column_sql_types: { b: "text" } }
>
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>

type ExprCross = ParseExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner, WhereCtxEmpty>
type _exprCross = Expect<ExprCross[1] extends { ok: true; ts: boolean } ? true : false>

describe("parse-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
