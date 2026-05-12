import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"

import type { Expect, Extends } from "./test-utils/type-test-utils.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type {
	EmptyExpressionParams,
	ParseExpressionAST,
	ResolveExpressionAST,
	SqlCastTypeNorm,
} from "../src/parser/parse-expression.ts"
import type { ParseSqlStatement as _ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"
import type { TBoolean, TInteger, TText, TUuid, TNull } from "./test-utils/sql-type-helpers.ts"
import type { SqlTypeShape } from "../src/core/sql-type-shape.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: TUuid; name: TText }
				}
			}
		}
	}
}

type TestEnvForExprParse = {
	db: DbUsers
	params: EmptyExpressionParams
	outerScope: {}
	positionalParamIndex: 0
}

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: TUuid; name: TText }
}

type UsersScope = Record<"users", UsersEntry>

type WParamUnknownTs = ParseWhereExpression<ParseSqlTokens<`:p = 'x'`>, DbUsers, UsersScope, { p: SqlTypeShape }>
type _wParamUnknownTs = Expect<Extends<WParamUnknownTs[1], null>>

type WParamBoolOk = ParseWhereExpression<ParseSqlTokens<`:flag`>, DbUsers, UsersScope, { flag: TBoolean }>
type _wParamBoolOk = Expect<Extends<WParamBoolOk[1], null>>

type InnerScope = Record<"inner_t", { schema: "public"; table: "inner_t"; columns: { a: TInteger } }>
type OuterScope = Record<"outer_t", { schema: "public"; table: "outer_t"; columns: { b: TText } }>
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>

type ExprCross = ParseWhereExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner>
type _exprCross = Expect<Extends<ExprCross[1], null>>

type UAdd = ParseExpressionAST<ParseSqlTokens<`1 + 2`>, TestEnvForExprParse>
type _uAdd = Expect<Extends<UAdd[1], { kind: "add" }>>

type UCmp = ParseExpressionAST<ParseSqlTokens<`2 > 0`>, TestEnvForExprParse>
type _uCmp = Expect<Extends<UCmp[1], { kind: "cmp"; op: "gt" }>>

type UAndCmp = ParseExpressionAST<ParseSqlTokens<`(2 > 0) and (1 < 3)`>, TestEnvForExprParse>
type _uAndCmp = Expect<Extends<UAndCmp[1], { kind: "and" }>>

type UOrAndPrec = ParseExpressionAST<ParseSqlTokens<`true or false and false`>, TestEnvForExprParse>
type _uOrAndPrec = Expect<Extends<UOrAndPrec[1], { kind: "or" }>>

type UCastPg = ParseExpressionAST<ParseSqlTokens<`1::text`>, TestEnvForExprParse>
type _uCastPg = Expect<Extends<UCastPg[1], { kind: "pg_cast" }>>

type UCastSql = ParseExpressionAST<ParseSqlTokens<`cast(7 as bigint)`>, TestEnvForExprParse>
type _uCastSql = Expect<Extends<UCastSql[1], { kind: "sql_cast" }>>

type _normDouble = Expect<Extends<SqlCastTypeNorm<readonly ["double", "precision"]>, "double precision">>

type UCaseSearched = ParseExpressionAST<ParseSqlTokens<`case when true then 1 else 2 end`>, TestEnvForExprParse>
type _uCaseSearched = Expect<Extends<UCaseSearched[1], { kind: "case_searched" }>>

type UCaseSimple = ParseExpressionAST<ParseSqlTokens<`case 1 when 1 then 2 else 3 end`>, TestEnvForExprParse>
type _uCaseSimple = Expect<Extends<UCaseSimple[1], { kind: "case_simple" }>>

type RCaseNoElse = ResolveExpressionAST<
	ParseExpressionAST<ParseSqlTokens<`case when false then 1 end`>, TestEnvForExprParse> extends [
		infer _R,
		infer Ast,
		infer _Env,
	]
		? Ast
		: never,
	DbUsers,
	UsersScope,
	EmptyExpressionParams
>
type _rCaseNoElse = Expect<Extends<RCaseNoElse, TNull<"integer">>>

type WExistsOk = ParseWhereExpression<ParseSqlTokens<`exists (select users.id from users)`>, DbUsers, UsersScope>
type _wExistsOk = Expect<Extends<WExistsOk[1], null>>

type WInSubqueryOk = ParseWhereExpression<
	ParseSqlTokens<`users.id in (select users.id from users)`>,
	DbUsers,
	UsersScope
>
type _wInSubqueryOk = Expect<Extends<WInSubqueryOk[1], null>>

type UMod = ParseExpressionAST<ParseSqlTokens<`5 % 2`>, TestEnvForExprParse>
type _uMod = Expect<Extends<UMod[1], { kind: "mod" }>>

type UExp = ParseExpressionAST<ParseSqlTokens<`2 ^ 3`>, TestEnvForExprParse>
type _uExp = Expect<Extends<UExp[1], { kind: "exp" }>>

type UCustomOp = ParseExpressionAST<ParseSqlTokens<`a || b`>, TestEnvForExprParse>
type _uCustomOp = Expect<Extends<UCustomOp[1], { kind: "custom_op"; op: "||" }>>

type UCustomOp2 = ParseExpressionAST<ParseSqlTokens<`a ->> b`>, TestEnvForExprParse>
type _uCustomOp2 = Expect<Extends<UCustomOp2[1], { kind: "custom_op"; op: "->>" }>>

type UOperatorSym = ParseExpressionAST<ParseSqlTokens<`a OPERATOR(+) b`>, TestEnvForExprParse>
type _uOperatorSym = Expect<Extends<UOperatorSym[1], { kind: "custom_op"; op: "+" }>>

describe("parse-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
