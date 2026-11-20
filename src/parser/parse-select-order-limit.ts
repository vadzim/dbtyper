import type { ParamProbeFound, ProbeKeyOf } from "../core/param-probe.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ParseExpressionAST } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { ViewReads, MergeViewReads } from "./parse-select-resolve.ts"
import type { SqlInteger, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { WindowDefs, WindowUsesError } from "./parse-select-window.ts"

/** Scalar `ORDER BY` / `LIMIT` / `OFFSET` value: any resolved expression (unlike `WHERE`, not restricted to `boolean`). */
type ParseOrderByScalarExpr<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Clause extends string = "ORDER BY",
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
				? R extends DbtyperErrorShape
					? SkipFailedExpression<Rw, WithErrorClause<R, Clause>>
					: R extends SqlTypeShape
						? R["type"] extends "param-probe"
							? Clause extends "LIMIT" | "OFFSET"
								? SkipFailedExpression<Rw, ParamProbeFound<ProbeKeyOf<R>, SqlInteger>>
								: [Rw, null]
							: [Rw, null]
						: SkipFailedExpression<Rw, never>
				: never
		: never

/** `LIMIT <expr>`, or PostgreSQL's `LIMIT ALL` (PGT-23; the dialect phrase `limit all` rejects it in other chains). */
type ParseLimitValue<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"all">
		? [SkipToken<Tokens>, null]
		: ParseOrderByScalarExpr<Tokens, Db, Scope, Params, "LIMIT">

/** SEL-31: a bare identifier that names an output column is that output column (no scope resolution). */
type ParseOrderByTermExpr<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
	Wins extends WindowDefs,
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer Rw extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? SkipFailedExpression<Rw, Ast>
			: Ast extends { kind: "col"; parts: readonly [infer _N extends OutNames] }
				? [Rw, null]
				: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer R
					? R extends DbtyperErrorShape
						? SkipFailedExpression<Rw, WithErrorClause<R, "ORDER BY">>
						: R extends SqlTypeShape
							? WindowUsesError<Ast, Wins, Db> extends infer Ue extends DbtyperErrorShape
								? SkipFailedExpression<Rw, Ue> // FN-32, FN-33: `ORDER BY rank() OVER w`
								: [Rw, ViewReads<Db, Ast, Scope>] // null, but a CREATE VIEW's types read (#212)
							: SkipFailedExpression<Rw, never>
					: never
		: never

type ParseOrderByOneTerm<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
	Wins extends WindowDefs,
> =
	ParseOrderByTermExpr<Tokens, Db, Scope, Params, OutNames, Wins> extends [infer R1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<"asc">
				? [SkipToken<R1>, E1]
				: PeekToken<R1> extends TokenKey<"desc">
					? [SkipToken<R1>, E1]
					: [R1, E1]
		: never

type ParseOrderByTerms<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
	Wins extends WindowDefs,
> =
	ParseOrderByOneTerm<Tokens, Db, Scope, Params, OutNames, Wins> extends [infer R1 extends ParserMonad, infer E1]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpression<R1, E1>
			: PeekToken<R1> extends TokenKey<",">
				? ParseOrderByTerms<SkipToken<R1>, Db, Scope, Params, OutNames, Wins> extends [
						infer R2 extends ParserMonad,
						infer E2,
					]
					? E2 extends DbtyperErrorShape
						? [R2, E2]
						: [R2, MergeViewReads<E1, E2>]
					: never
				: [R1, E1]
		: never

type ParseOrderByAfterOrderKw<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
	Wins extends WindowDefs,
> =
	PeekToken<R1> extends infer TBy
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? TBy extends TokenKey<"by">
				? ParseOrderByTerms<R2, Db, Scope, Params, OutNames, Wins>
				: SkipFailedExpression<R2, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>>
			: never
		: never

export type ParseOptionalOrderByTokens<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	OutNames extends string,
	Wins extends WindowDefs = {},
> =
	PeekToken<Tokens> extends TokenKey<"order">
		? ParseOrderByAfterOrderKw<SkipToken<Tokens>, Db, Scope, Params, OutNames, Wins>
		: [Tokens, null]

type LimitExprThenOptionalOffset<
	Rl1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Rl1> extends TokenKey<"offset">
		? SkipToken<Rl1> extends infer Ro0 extends ParserMonad
			? ParseOrderByScalarExpr<Ro0, Db, Scope, Params, "OFFSET"> extends [infer Ro1 extends ParserMonad, infer Oe]
				? Oe extends DbtyperErrorShape
					? SkipFailedExpression<Ro1, Oe>
					: [Ro1, null]
				: never
			: never
		: PeekToken<Rl1> extends TokenKey<",">
			? DialectFact<Db, "limitComma"> extends true
				? SkipToken<Rl1> extends infer Rc extends ParserMonad
					? ParseOrderByScalarExpr<Rc, Db, Scope, Params, "LIMIT"> extends [
							infer Rc1 extends ParserMonad,
							infer Ce,
						]
						? Ce extends DbtyperErrorShape
							? SkipFailedExpression<Rc1, Ce>
							: [Rc1, null]
						: never
					: never
				: [Rl1, null]
			: [Rl1, null]

/** After `OFFSET` expr: optional `LIMIT` expr (PostgreSQL allows `OFFSET … LIMIT …`). */
type OffsetExprThenOptionalLimit<
	Ro1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Ro1> extends TokenKey<"limit">
		? SkipToken<Ro1> extends infer Rl0 extends ParserMonad
			? ParseLimitValue<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
				? Le extends DbtyperErrorShape
					? SkipFailedExpression<Rl1, Le>
					: [Rl1, null]
				: never
			: never
		: [Ro1, null]

type ExpectRowOrRowsThenOnly<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"rows">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"only">
				? [SkipToken<R1>, null]
				: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_ONLY_AFTER_FETCH_ROWS"], []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"row">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"only">
					? [SkipToken<R1>, null]
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_ONLY_AFTER_FETCH_ROW"], []>>
				: never
			: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_ROW_OR_ROWS_IN_FETCH"], []>>

type ParseFetchFirstAfterFetchKw<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenKey<"first">
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? ParseOrderByScalarExpr<R2, Db, Scope, Params, "FETCH"> extends [infer R3 extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? SkipFailedExpression<R3, E>
					: ExpectRowOrRowsThenOnly<R3>
				: never
			: never
		: PeekToken<R1> extends TokenKey<"next">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? ParseOrderByScalarExpr<R2, Db, Scope, Params, "FETCH"> extends [infer R3 extends ParserMonad, infer E]
					? E extends DbtyperErrorShape
						? SkipFailedExpression<R3, E>
						: ExpectRowOrRowsThenOnly<R3>
					: never
				: never
			: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_FIRST_OR_NEXT_AFTER_FETCH"], []>>

/** Optional `LIMIT …` / `OFFSET …` / `FETCH FIRST|NEXT … ROW(S) ONLY` (single paging block). */
export type ParseOptionalPagingTokens<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"limit">
		? SkipToken<Tokens> extends infer Rl0 extends ParserMonad
			? ParseLimitValue<Rl0, Db, Scope, Params> extends [infer Rl1 extends ParserMonad, infer Le]
				? Le extends DbtyperErrorShape
					? SkipFailedExpression<Rl1, Le>
					: LimitExprThenOptionalOffset<Rl1, Db, Scope, Params>
				: never
			: never
		: PeekToken<Tokens> extends TokenKey<"offset">
			? SkipToken<Tokens> extends infer Ro0 extends ParserMonad
				? ParseOrderByScalarExpr<Ro0, Db, Scope, Params, "OFFSET"> extends [
						infer Ro1 extends ParserMonad,
						infer Oe,
					]
					? Oe extends DbtyperErrorShape
						? SkipFailedExpression<Ro1, Oe>
						: OffsetExprThenOptionalLimit<Ro1, Db, Scope, Params>
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"fetch">
				? ParseFetchFirstAfterFetchKw<SkipToken<Tokens>, Db, Scope, Params>
				: [Tokens, null]
