import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { ViewReads, MergeViewReads } from "./parse-select-resolve.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

/**
 * PGT-23: `DISTINCT ON (expr, …)` after the keyword `ON`. The expressions are parsed here and resolved against the
 * FROM scope by {@link DistinctOnError} (the list comes before FROM). Returns `[Tokens, asts | error]`.
 */
export type ParseDistinctOnList<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseDistinctOnItems<SkipToken<Tokens>, Db, Params, OuterScope, readonly []>
		: SkipFailedExpression<Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["ON"]>>

type ParseDistinctOnItems<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap,
	Acc extends readonly ScalarExprAst[],
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: OuterScope }> extends [
		infer R1 extends ParserMonad,
		infer Ast,
		infer _Env,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<R1, Ast>
			: Ast extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseDistinctOnItems<SkipToken<R1>, Db, Params, OuterScope, readonly [...Acc, Ast]>
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, Ast]]
						: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>>
				: never
		: never

/**
 * The first error of the `DISTINCT ON` expressions resolved against the FROM scope, or `null` (#212: or the
 * `ViewReads` of a CREATE VIEW, which the caller adds to the select's `user_types`).
 */
export type DistinctOnError<
	OnAsts extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Reads = null,
> = OnAsts extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
		? R extends DbtyperErrorShape
			? WithErrorClause<R, "DISTINCT ON">
			: DistinctOnError<T, Db, Scope, Params, MergeViewReads<Reads, ViewReads<Db, H, Scope>>>
		: never
	: Reads
