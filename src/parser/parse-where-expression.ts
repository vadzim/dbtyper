import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { TokensList } from "../lexer/sql-tokens.ts"
import type { FormatError, SqlParserError as _SqlParserError, DbtyperError } from "../sql-parser-error.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseExpressionAST,
	ResolveExpressionAST,
} from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

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
		? Ast extends DbtyperError<any, any> | DbtyperError<any, any>
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends DbtyperError<any, any> | DbtyperError<any, any>
					? SkipFailedExpression<Rw, R>
					: R extends SqlTypeShape
						? R["type"] extends "boolean"
							? [Rw, null]
							: SkipFailedExpression<Rw, FormatError<"EXPRESSION_MUST_BE_BOOLEAN", [R["type"]]>>
						: SkipFailedExpression<Rw, FormatError<"EXPRESSION_MUST_BE_BOOLEAN", ["unknown"]>>
				: never
		: never
