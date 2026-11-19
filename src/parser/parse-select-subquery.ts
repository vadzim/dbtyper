import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { FromItemsOnly, MergeScope, ScopeEntry, ScopeMap } from "./parser-scope.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { ParseSelectExpression } from "./parse-select.ts"

/** Row shape of a parsed inner `SELECT` used as a derived table in `FROM` / `JOIN`. */
/** A CTE definition: visible by name in FROM, but not itself a FROM item (see `FromItemsOnly`). */
export type SelectResultToCteScopeEntry<Res extends JsqlSelectStatementResult> = {
	schema: "__cte__"
	table: "__subquery__"
	columns: Res["returning"]
}

export type CteAsFromEntry<E extends ScopeEntry> = { schema: "__subquery__"; table: E["table"]; columns: E["columns"] }

type SelectResultToDerivedScopeEntry<Res extends JsqlSelectStatementResult> = {
	schema: "__subquery__"
	table: "__subquery__"
	columns: Res["returning"]
}

/** Helper: Consume closing `)` after subquery. Returns [Tokens, Result] or error. */
export type ConsumeClosingParen<Tokens extends ParserMonad, Result> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Result]
		: Result extends JsqlSelectStatementResult
			? SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY"], []>>
			: [Tokens, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_SUBQUERY"], []>]

/** Helper: Validate that a SELECT result has exactly one column (for scalar subqueries). */
type ValidateSingleColumn<Result extends JsqlSelectStatementResult> = Result["returning"] extends infer Cols
	? [keyof Cols] extends [infer K]
		? K extends string
			? Result
			: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>
		: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>
	: never

/** Helper: Parse alias after derived table and merge into scope. Returns [Tokens, null, Scope] or error. */
type ParseAliasAfterDerived<
	Tokens extends ParserMonad,
	_Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Result extends JsqlSelectStatementResult,
> =
	SelectResultToDerivedScopeEntry<Result> extends infer Entry extends ScopeEntry
		? PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras extends ParserMonad
				? AsIdent<PeekToken<Ras>> extends TokenIdent<infer Alias extends string>
					? [SkipToken<Ras>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
					: [
							SkipToken<Ras>,
							FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>,
							ParserRefErrorThirdSentinel,
						]
				: never
			: PeekToken<Tokens> extends TokenIdent<infer Alias extends string>
				? [SkipToken<Tokens>, null, MergeScope<Record<Alias, Entry>, OuterScope>]
				: [Tokens, FormatError<Errors["EXPECTED_ALIAS_AFTER_DERIVED_TABLE"], []>, ParserRefErrorThirdSentinel]
		: never

/** Inner `( SELECT … FROM … [WHERE …] )` ending with `)`; multi-column allowed (`EXISTS`, CTE, `IN (SELECT …)`). */
export type ParseParenEnclosedSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
	CteBase extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope, CteBase> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result>
					: never
			: never
		: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>

/** Scalar subquery: exactly one non-`*` projection. */
export type ParseParenScalarSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	OuterScope extends ScopeMap = {},
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, OuterScope> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? SkipFailedExpression<R2, Result>
				: Result extends JsqlSelectStatementResult
					? ValidateSingleColumn<Result> extends infer Validated
						? Validated extends DbtyperErrorShape
							? SkipFailedExpression<R2, Validated>
							: ConsumeClosingParen<R2, Validated>
						: never
					: never
			: never
		: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>

export type ParseParenDerivedSelect<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	OuterScope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Lateral extends boolean = false,
> =
	PeekToken<R1> extends TokenKey<"select">
		? ParseSelectExpression<SkipToken<R1>, Db, Params, Lateral extends true ? FromItemsOnly<OuterScope> : {}> extends [
				infer R2 extends ParserMonad,
				infer _Db2 extends JsqlDatabaseShape,
				infer Result,
			]
			? Result extends DbtyperErrorShape
				? [R2, Result, ParserRefErrorThirdSentinel]
				: Result extends JsqlSelectStatementResult
					? ConsumeClosingParen<R2, Result> extends [infer R3 extends ParserMonad, infer Validated]
						? Validated extends DbtyperErrorShape
							? [R3, Validated, ParserRefErrorThirdSentinel]
							: Validated extends JsqlSelectStatementResult
								? ParseAliasAfterDerived<R3, Db, OuterScope, Validated>
								: never
						: never
					: never
			: never
		: [R1, FormatError<Errors["EXPECTED_SELECT_IN_DERIVED_TABLE"], []>, ParserRefErrorThirdSentinel]
