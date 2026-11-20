/**
 * Named windows (FN-30…FN-35, #214): the `WINDOW w AS (…)` clause of a SELECT and the OVER clauses that use one.
 *
 * The definitions are parsed by the one window-spec parser of OVER (`ParseWindowSpec`, parse-function-call.ts). A
 * SELECT keeps, per window name, only what an extension may not change (FN-33): whether the window has PARTITION BY,
 * ORDER BY, a frame. The select list is parsed before the WINDOW clause is reached, so its OVER clauses are checked
 * when the clause has been read ({@link WindowUsesError} over the list's ASTs); ORDER BY terms are checked as they are
 * read. A named window never changes a type (FN-31): the resolver does not read `over`.
 */
import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { LastOf } from "../core/type-utils.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { WindowSpecAst } from "./parse-expression-ast.ts"
import type { ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ParseWindowSpec } from "./parse-function-call.ts"
import type { MergeViewReads, ViewReads } from "./parse-select-resolve.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"

/** What a window has, as far as an extension of it is concerned (FN-33). */
type WindowFlags = { p: boolean; o: boolean; f: boolean }

/** The windows of one SELECT's WINDOW clause by name (`{}`: no clause). */
export type WindowDefs = { [name: string]: WindowFlags }

/**
 * Optional `WINDOW w AS (…) [, …]` (FN-30). Returns `[rest, { windows, reads } | error]`: `reads` are the user types
 * the definitions read in a CREATE VIEW (FN-35, `ViewReads`), `null` when none.
 */
export type ParseOptionalWindowClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"window">
		? ParseWindowDefinitions<SkipToken<Tokens>, Db, Scope, Params, {}, null>
		: [Tokens, { windows: {}; reads: null }]

type ParseWindowDefinitions<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Defs extends WindowDefs,
	Reads,
> =
	PeekToken<Tokens> extends TokenIdent<infer N extends string>
		? N extends keyof Defs
			? SkipFailedExpression<Tokens, FormatError<Errors["DUPLICATE_WINDOW_NAME"], [N]>>
			: SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"as">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"(">
							? ParseWindowSpec<SkipToken<R2>, { db: Db; params: Params; outerScope: Scope }> extends [
									infer R3 extends ParserMonad,
									infer Spec,
									infer _Env,
								]
								? Spec extends WindowSpecAst
									? WindowDefinitionError<Spec, Defs, Db, Scope, Params> extends infer F
										? F extends DbtyperErrorShape
											? SkipFailedExpression<R3, F>
											: F extends WindowFlags
												? PeekToken<R3> extends TokenKey<",">
													? ParseWindowDefinitions<
															SkipToken<R3>,
															Db,
															Scope,
															Params,
															Defs & { [K in N]: F },
															MergeViewReads<Reads, ViewReads<Db, Spec, Scope>>
														>
													: [
															R3,
															{
																windows: Defs & { [K in N]: F }
																reads: MergeViewReads<Reads, ViewReads<Db, Spec, Scope>>
															},
														]
												: never
										: never
									: [R3, Spec]
								: never
							: SkipFailedExpression<R2, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>>
						: never
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>>
				: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_NAME"], []>>

/** A definition's own columns resolve against the FROM items (FN-30: unknown → 2300), then its flags or error. */
type WindowDefinitionError<
	Spec extends WindowSpecAst,
	Defs extends WindowDefs,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	FirstResolveError<
		readonly [...Spec["partition_by"], ...OrderExprs<Spec["order_by"]>, ...FrameExprs<Spec["frame"]>],
		Db,
		Scope,
		Params
	> extends infer E extends DbtyperErrorShape
		? E
		: WindowFlagsOf<Spec, Defs, Db>

type OrderExprs<O extends WindowSpecAst["order_by"]> = { [I in keyof O]: O[I]["expr"] }

type FrameExprs<F extends WindowSpecAst["frame"]> = F extends readonly ScalarExprAst[] ? F : readonly []

type FirstResolveError<
	Exprs extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Exprs extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
		? R extends DbtyperErrorShape
			? WithErrorClause<R, "WINDOW clause">
			: FirstResolveError<T, Db, Scope, Params>
		: never
	: null

/**
 * The flags of a window spec, or its error: a spec without a name stands for itself; one that names a window starts
 * from it (FN-31) and may only add what the window lacks (FN-33). `OVER w` takes the window as it is.
 */
type WindowFlagsOf<Spec extends WindowSpecAst, Defs extends WindowDefs, Db> = Spec["ref"] extends infer W extends string
	? W extends keyof Defs
		? Spec["bare"] extends true
			? Defs[W]
			: ExtendWindow<Spec, Defs[W], W, Db>
		: FormatError<Errors["UNKNOWN_WINDOW"], [W]>
	: {
			p: Spec["partition_by"] extends readonly [] ? false : true
			o: Spec["order_by"] extends readonly [] ? false : true
			f: Spec["frame"] extends null ? false : true
		}

type ExtendWindow<Spec extends WindowSpecAst, Base extends WindowFlags, W extends string, Db> = Spec extends {
	partition_by: readonly [unknown, ...unknown[]]
}
	? FormatError<Errors["WINDOW_ALREADY_HAS_PARTITION_BY"], [W]>
	: [Spec["order_by"], Base["o"]] extends [readonly [unknown, ...unknown[]], true]
		? FormatError<Errors["WINDOW_ALREADY_HAS_ORDER_BY"], [W]>
		: Base["f"] extends true
			? Spec["frame"] extends null
				? DialectFact<Db, "copyFramedWindow"> extends true
					? Base
					: FormatError<Errors["WINDOW_HAS_FRAME_CLAUSE"], [W]>
				: FormatError<Errors["WINDOW_HAS_FRAME_CLAUSE"], [W]>
			: {
					p: Base["p"]
					o: Spec["order_by"] extends readonly [] ? Base["o"] : true
					f: Spec["frame"] extends null ? false : true
				}

/**
 * The first error of an OVER clause in `A` (a select list's items, an ORDER BY term) that names a window `Defs` does
 * not have or extends one wrongly (FN-32, FN-33), else `null`. Subqueries are not entered: each SELECT checked its own.
 */
export type WindowUsesError<A, Defs extends WindowDefs, Db> = A extends WindowFree
	? null // the common case, by assignability alone: no walk
	: [UsesErrors<A, Defs, Db>] extends [never]
		? null
		: LastOf<UsesErrors<A, Defs, Db>>

/**
 * Select items and ASTs with no OVER that names a window, as a type: every property that can hold an expression is
 * listed, and a window call may only have an unnamed spec (`ref: null`).
 */
type WindowFree = WindowFreeAst | WindowFreeItem | readonly WindowFreeItem[]

type WindowFreeItem = { kind: "star" } | { kind: "param" } | { kind: "expr"; ast: WindowFreeAst }

type WindowFreeAst = {
	kind: ScalarExprAst["kind"]
	over?: { ref: null }
	args?: readonly (WindowFreeAst | { kind: "star" })[]
	left?: WindowFreeAst
	right?: WindowFreeAst | JsqlSelectStatementResult
	inner?: WindowFreeAst
	expr?: WindowFreeAst
	items?: readonly WindowFreeAst[]
	elements?: readonly WindowFreeAst[]
	base?: WindowFreeAst
	index?: WindowFreeAst
	low?: WindowFreeAst
	high?: WindowFreeAst
	pattern?: WindowFreeAst
	discriminant?: WindowFreeAst
	arms?: readonly { when: WindowFreeAst; then: WindowFreeAst }[]
	else_?: WindowFreeAst | null
}

type UsesErrors<A, Defs extends WindowDefs, Db> = A extends { kind: "expr"; ast: infer X } // a select item
	? UsesErrors<X, Defs, Db>
	: A extends { kind: UsesFreeKind } | string | null
		? never
		: A extends { kind: "window_function"; over: infer O extends WindowSpecAst }
			? O["ref"] extends string
				? WindowFlagsOf<O, Defs, Db> extends infer F extends DbtyperErrorShape
					? F
					: never
				: never
			: A extends { kind: "function_call"; args: infer X }
				? UsesErrors<X, Defs, Db>
				: A extends { left: infer L; right: infer R }
					? UsesErrors<L, Defs, Db> | UsesErrors<R, Defs, Db>
					: A extends { kind: "pg_cast" | "sql_cast" | "is_null" | "is_not_null"; expr: infer X }
						? UsesErrors<X, Defs, Db>
						: A extends readonly (infer E)[]
							? UsesErrors<E, Defs, Db>
							: A extends { returning: unknown } // a subquery's result
								? never
								: A extends object
									? {
											[K in keyof A]: K extends "kind" | "sub" | "sel"
												? never
												: UsesErrors<A[K], Defs, Db>
										}[keyof A]
									: never

/** AST nodes that hold no window call of this SELECT (leaves, `*`, subqueries: each checked its own). */
type UsesFreeKind =
	| "col"
	| "number"
	| "string"
	| "true"
	| "false"
	| "sql_null"
	| "param"
	| "positional-param"
	| "star"
	| "qualified_table_star"
	| "alias_table_star"
	| "scalar_subquery"
	| "exists_subquery"
