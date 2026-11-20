import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { Nullable, SqlNull, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { EnumComparisonCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { MergeComparison, SameComparisonClass } from "./resolve-expression-compare.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ConditionProbeOr, IsConditionType } from "./resolve-operators.ts"

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<
	Disc extends SqlTypeShape,
	WhenV extends SqlTypeShape,
	DiscAst = never,
	WhenAst = never,
> = MergeComparison<Disc, WhenV, DiscAst, WhenAst> extends infer M extends DbtyperErrorShape ? M : true

/** The AST of the branch whose type the CASE has so far: the first one that is not a NULL literal (EXPR-20). */
type NextCaseAccAst<Acc extends SqlTypeShape | null, AccAst, TvAst> = Acc extends SqlTypeShape
	? Acc["type"] extends "null"
		? TvAst
		: AccAst
	: TvAst

type MergeCaseThenAccum<
	Acc extends SqlTypeShape | null,
	Tv extends SqlTypeShape,
	AccAst = never,
	TvAst = never,
> = Acc extends null
	? Tv
	: Acc extends SqlTypeShape
		? Acc["type"] extends "null"
			? Tv["type"] extends "null"
				? SqlNull
				: Nullable<Tv>
			: Tv["type"] extends "null"
				? Nullable<Acc>
				: SameComparisonClass<Acc, Tv, AccAst, TvAst> extends true
					? Tv["nullable"] extends true
						? Nullable<Acc>
						: Acc
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_CASE"], []>
		: never

type ApplyCaseMissingElseNullability<E extends SqlTypeShape, MissingElse extends boolean> = MissingElse extends true
	? { type: E["type"]; arg: E["arg"]; nullable: true }
	: E

type ResolveCaseSearchedArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Acc extends SqlTypeShape | null,
	AccAst,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? IsConditionType<Db, Wv> extends true
					? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
						? Tv extends DbtyperErrorShape
							? Tv
							: Tv extends SqlTypeShape
								? MergeCaseThenAccum<Acc, Tv, AccAst, A["then"]> extends infer Merged
									? Merged extends DbtyperErrorShape
										? Merged
										: Merged extends SqlTypeShape
											? ResolveCaseSearchedArms<
													Rest,
													ElseB,
													Db,
													Scope,
													Merged,
													NextCaseAccAst<Acc, AccAst, A["then"]>,
													Params
												>
											: never
									: never
								: never
						: never
					: ConditionProbeOr<Db, Wv, FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>> // #164
				: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev, AccAst, ElseB> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

export type ResolveCaseSearched<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ResolveCaseSearchedArms<Arms, ElseB, Db, Scope, null, never, Params>

type ResolveCaseSimpleArms<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Disc extends SqlTypeShape,
	DiscAst,
	Acc extends SqlTypeShape | null,
	AccAst,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Arms extends readonly [
	infer A extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
]
	? ResolveExpressionAST<A["when"], Db, Scope, Params> extends infer Wv
		? Wv extends DbtyperErrorShape
			? Wv
			: Wv extends SqlTypeShape
				? WithEnumCheck<
						EnumComparisonCheck<Db, Disc, DiscAst, Wv, A["when"]>,
						ValidateCaseSimpleWhenMatch<Disc, Wv, DiscAst, A["when"]>
					> extends infer Match
					? Match extends DbtyperErrorShape
						? Match
						: Match extends true
							? ResolveExpressionAST<A["then"], Db, Scope, Params> extends infer Tv
								? Tv extends DbtyperErrorShape
									? Tv
									: Tv extends SqlTypeShape
										? MergeCaseThenAccum<Acc, Tv, AccAst, A["then"]> extends infer Merged
											? Merged extends DbtyperErrorShape
												? Merged
												: Merged extends SqlTypeShape
													? ResolveCaseSimpleArms<
															Rest,
															ElseB,
															Db,
															Scope,
															Disc,
															DiscAst,
															Merged,
															NextCaseAccAst<Acc, AccAst, A["then"]>,
															Params
														>
													: never
											: never
										: never
								: never
							: never
					: never
				: never
		: never
	: ElseB extends ScalarExprAst
		? ResolveExpressionAST<ElseB, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? MergeCaseThenAccum<Acc, Ev, AccAst, ElseB> extends infer F
						? F extends DbtyperErrorShape
							? F
							: F extends SqlTypeShape
								? ApplyCaseMissingElseNullability<F, false>
								: never
						: never
					: never
			: never
		: Acc extends SqlTypeShape
			? ApplyCaseMissingElseNullability<Acc, true>
			: never

export type ResolveCaseSimple<
	DiscAst extends ScalarExprAst,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<DiscAst, Db, Scope, Params> extends infer Dv
		? Dv extends DbtyperErrorShape
			? Dv
			: Dv extends SqlTypeShape
				? ResolveCaseSimpleArms<Arms, ElseB, Db, Scope, Dv, DiscAst, null, never, Params>
				: never
		: never

/** Per-element check for `expr IN (…)` (same class rules as `=`, but `NULL` list elements are rejected). */
