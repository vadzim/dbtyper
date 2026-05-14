import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
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
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope; positionalParamIndex: 0 }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends DbtyperErrorShape
					? SkipFailedExpression<Rw, R>
					: R extends SqlTypeShape
						? R["type"] extends "boolean"
							? [Rw, null]
							: SkipFailedExpression<Rw, FormatError<Errors["EXPRESSION_MUST_BE_BOOLEAN"], [R["type"]]>>
						: SkipFailedExpression<Rw, FormatError<Errors["EXPRESSION_MUST_BE_BOOLEAN"], ["unknown"]>>
				: never
		: never
