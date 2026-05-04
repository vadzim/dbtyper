import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../src/core/jsql-shapes.ts"
import type { ParseSqlTokens } from "../src/lexer/sql-tokens.ts"
import type { SqlParserError } from "../src/sql-parser-error.ts"
import type { Expect, Extends, Tuple2At1, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type {
	EmptyExpressionParams,
	ExprOk,
	ParseExpressionAST,
	ResolveExpressionAST,
	SqlCastTypeNorm,
} from "../src/parser/parse-expression.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"
import type { PackageScalarTypes } from "./test-utils/parser-test-utils.ts"

type DbUsers = {
	defaultSchema: "public"
	schemas: {
		public: JsqlSchemaShape & {
			sets: {
				users: {
					kind: "table"
					columns: { id: "uuid"; name: "text" }
				}
			}
		}
	}
	scalarTypes: PackageScalarTypes
}

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: "uuid"; name: "text" }
}

type UsersScope = Record<"users", UsersEntry>

type WUnknownParam = ParseWhereExpression<ParseSqlTokens<`:n = 'x'`>, DbUsers, UsersScope, EmptyExpressionParams>
type _wUnknownParam = Expect<Extends<Tuple2At1<WUnknownParam>, SqlParserError<"Unknown query parameter">>>

type WParamUnknownTs = ParseWhereExpression<
	ParseSqlTokens<`:p = 'x'`>,
	DbUsers,
	UsersScope,
	{ p: { ts: unknown; sql: "text" } }
>
type _wParamUnknownTs = Expect<Extends<Tuple2At1<WParamUnknownTs>, SqlParserError<"Parameter has unknown or any type">>>

type WParamBoolOk = ParseWhereExpression<
	ParseSqlTokens<`:flag`>,
	DbUsers,
	UsersScope,
	{ flag: { ts: true; sql: "boolean" } }
>
type _wParamBoolOk = Expect<Extends<Tuple2At1<WParamBoolOk>, null>>

type WNonBoolRoot = ParseWhereExpression<ParseSqlTokens<`users.id`>, DbUsers, UsersScope>
type _wNonBoolRoot = Expect<Extends<Tuple2At1<WNonBoolRoot>, SqlParserError<"Expression must be boolean">>>

/** Non-boolean root: same rule as `WHERE` (untyped parse + resolve). */
type SelBareCol = ParseWhereExpression<ParseSqlTokens<`users.id`>, DbUsers, UsersScope>
type _selBareCol = Expect<Extends<Tuple2At1<SelBareCol>, SqlParserError<"Expression must be boolean">>>

type TSelectParamNoBind = ParseSqlStatement<ParseSqlTokens<`select :limit, users.id from users;`>, DbUsers>
type _selectParamNoBind = Expect<
	Extends<Tuple3At2<TSelectParamNoBind>, SqlParserError<"Unknown query parameter in SELECT">>
>

type InnerScope = Record<"inner_t", { schema: "public"; table: "inner_t"; columns: { a: "integer" } }>
type OuterScope = Record<"outer_t", { schema: "public"; table: "outer_t"; columns: { b: "text" } }>
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>

type ExprCross = ParseWhereExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner>
type _exprCross = Expect<Extends<Tuple2At1<ExprCross>, null>>

type UAdd = ParseExpressionAST<ParseSqlTokens<`1 + 2`>>
type _uAdd = Expect<Extends<Tuple2At1<UAdd>, { kind: "add" }>>

type UCmp = ParseExpressionAST<ParseSqlTokens<`2 > 0`>>
type _uCmp = Expect<Extends<Tuple2At1<UCmp>, { kind: "cmp"; op: "gt" }>>

type UAndCmp = ParseExpressionAST<ParseSqlTokens<`(2 > 0) and (1 < 3)`>>
type _uAndCmp = Expect<Extends<Tuple2At1<UAndCmp>, { kind: "and" }>>

type UOrAndPrec = ParseExpressionAST<ParseSqlTokens<`true or false and false`>>
type _uOrAndPrec = Expect<Extends<Tuple2At1<UOrAndPrec>, { kind: "or" }>>

type UIsBad = ParseExpressionAST<ParseSqlTokens<`1 is 2`>>
type _uIsBad = Expect<Extends<Tuple2At1<UIsBad>, SqlParserError<"Expected NULL after IS">>>

type RNotNum = ResolveExpressionAST<
	ParseExpressionAST<ParseSqlTokens<`not 1`>> extends [infer _R, infer Ast] ? Ast : never,
	DbUsers,
	UsersScope,
	EmptyExpressionParams
>
type _rNotNum = Expect<Extends<RNotNum, SqlParserError<"NOT requires a boolean operand">>>

type RUnaryMinusText = ResolveExpressionAST<
	ParseExpressionAST<ParseSqlTokens<`-(users.name)`>> extends [infer _R, infer Ast] ? Ast : never,
	DbUsers,
	UsersScope,
	EmptyExpressionParams
>
type _rUnaryMinusText = Expect<Extends<RUnaryMinusText, SqlParserError<"Unary minus requires a number">>>

type UCastPg = ParseExpressionAST<ParseSqlTokens<`1::text`>>
type _uCastPg = Expect<Extends<Tuple2At1<UCastPg>, { kind: "pg_cast" }>>

type UCastSql = ParseExpressionAST<ParseSqlTokens<`cast(7 as bigint)`>>
type _uCastSql = Expect<Extends<Tuple2At1<UCastSql>, { kind: "sql_cast" }>>

type _normDouble = Expect<Extends<SqlCastTypeNorm<readonly ["double", "precision"]>, "double precision">>

type UCaseSearched = ParseExpressionAST<ParseSqlTokens<`case when true then 1 else 2 end`>>
type _uCaseSearched = Expect<Extends<Tuple2At1<UCaseSearched>, { kind: "case_searched" }>>

type UCaseSimple = ParseExpressionAST<ParseSqlTokens<`case 1 when 1 then 2 else 3 end`>>
type _uCaseSimple = Expect<Extends<Tuple2At1<UCaseSimple>, { kind: "case_simple" }>>

type RCaseNoElse = ResolveExpressionAST<
	ParseExpressionAST<ParseSqlTokens<`case when false then 1 end`>> extends [infer _R, infer Ast] ? Ast : never,
	DbUsers,
	UsersScope,
	EmptyExpressionParams
>
type _rCaseNoElse = Expect<Extends<RCaseNoElse, ExprOk<number | null, "integer">>>

type WExistsOk = ParseWhereExpression<ParseSqlTokens<`exists (select users.id from users)`>, DbUsers, UsersScope>
type _wExistsOk = Expect<Extends<Tuple2At1<WExistsOk>, null>>

type WInSubqueryOk = ParseWhereExpression<
	ParseSqlTokens<`users.id in (select users.id from users)`>,
	DbUsers,
	UsersScope
>
type _wInSubqueryOk = Expect<Extends<Tuple2At1<WInSubqueryOk>, null>>

type UMod = ParseExpressionAST<ParseSqlTokens<`5 % 2`>>
type _uMod = Expect<Extends<Tuple2At1<UMod>, { kind: "mod" }>>

type UExp = ParseExpressionAST<ParseSqlTokens<`2 ^ 3`>>
type _uExp = Expect<Extends<Tuple2At1<UExp>, { kind: "exp" }>>

type UCustomOp = ParseExpressionAST<ParseSqlTokens<`a || b`>>
type _uCustomOp = Expect<Extends<Tuple2At1<UCustomOp>, { kind: "custom_op"; op: "||" }>>

type UCustomOp2 = ParseExpressionAST<ParseSqlTokens<`a ->> b`>>
type _uCustomOp2 = Expect<Extends<Tuple2At1<UCustomOp2>, { kind: "custom_op"; op: "->>" }>>

type UOperatorSym = ParseExpressionAST<ParseSqlTokens<`a OPERATOR(+) b`>>
type _uOperatorSym = Expect<Extends<Tuple2At1<UOperatorSym>, { kind: "custom_op"; op: "+" }>>

describe("parse-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
