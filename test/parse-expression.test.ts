import { describe, it } from "node:test"
import type { JsqlSchemaShape } from "../core/jsql-shapes.ts"
import type { ParseSqlTokens, SqlParserError } from "../core/sql-tokens.ts"
import type { Expect, Extends, Tuple2At1, Tuple3At2 } from "./test-utils/type-test-utils.ts"
import type { MergeScope } from "../src/parser/parser-scope.ts"
import type {
	EmptyExpressionParams,
	ExpressionParseContext,
	ParseBooleanExpression,
	ParseExpressionAST,
	ResolveExpressionAST,
} from "../src/parser/parse-expression.ts"
import type { ParseSqlStatement } from "../src/parser/parse-sql-statement.ts"
import type { ParseWhereExpression } from "../src/parser/parse-where-expression.ts"

type DbUsers = {
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
	}
}

type UsersEntry = {
	schema: "public"
	table: "users"
	columns: { id: string; name: string }
	column_sql_types: { id: "uuid"; name: "text" }
}

type UsersScope = Record<"users", UsersEntry>

type WhereCtxEmpty = ExpressionParseContext<"three_part", EmptyExpressionParams>

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

type ExprSelectCtx = ExpressionParseContext<"three_part", EmptyExpressionParams>

type SelBareCol = ParseBooleanExpression<ParseSqlTokens<`users.id`>, DbUsers, UsersScope, ExprSelectCtx>
type _selBareCol = Expect<Extends<Tuple2At1<SelBareCol>, SqlParserError<"Expression must be boolean">>>

type TSelectParamNoBind = ParseSqlStatement<ParseSqlTokens<`select :limit, users.id from users;`>, DbUsers>
type _selectParamNoBind = Expect<
	Extends<Tuple3At2<TSelectParamNoBind>, SqlParserError<"Unknown query parameter in SELECT">>
>

type InnerScope = Record<
	"inner_t",
	{ schema: "public"; table: "inner_t"; columns: { a: number }; column_sql_types: { a: "integer" } }
>
type OuterScope = Record<
	"outer_t",
	{ schema: "public"; table: "outer_t"; columns: { b: string }; column_sql_types: { b: "text" } }
>
type JoinedOuterInner = MergeScope<OuterScope, InnerScope>

type ExprCross = ParseBooleanExpression<ParseSqlTokens<`outer_t.b = 'x'`>, DbUsers, JoinedOuterInner, WhereCtxEmpty>
type _exprCross = Expect<Extends<Tuple2At1<ExprCross>, { ok: true; ts: boolean }>>

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
	ExprSelectCtx
>
type _rNotNum = Expect<Extends<RNotNum, SqlParserError<"NOT requires a boolean operand">>>

describe("parse-expression (type tests)", () => {
	it("compile-time assertions above", () => {})
})
