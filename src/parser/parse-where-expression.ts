import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type {
	EmptyExpressionParams,
	ExprOk,
	ExpressionParamsShape,
	ParseExpressionAST,
	ResolveExpressionAST,
} from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

/** WHERE predicate: tuple `[rest, error | null]` (not monad-registered; use from statement parsers). */
export type ParseWhereExpression<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends TokensList,
		infer Ast,
	]
		? Ast extends SqlParserError<string>
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends SqlParserError<string>
					? SkipFailedExpression<Rw, R>
					: R extends ExprOk<infer Ts, infer _Sql>
						? [Ts] extends [boolean]
							? [Rw, null]
							: SkipFailedExpression<Rw, SqlParserError<"Expression must be boolean">>
						: SkipFailedExpression<Rw, SqlParserError<"Expression must be boolean">>
				: never
		: never
