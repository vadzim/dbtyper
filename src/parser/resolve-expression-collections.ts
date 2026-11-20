import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParamProbeFound } from "../core/param-probe.ts"
import type { NonNull, Nullable, SqlArray, SqlBoolean, SqlTypeShape, SqlUnknown } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { EnumComparisonCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ScalarExprAst,
	SingleProjectionColumn,
} from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { MergeComparison, SameComparisonClass } from "./resolve-expression-compare.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"

export type ResolveArrayCtorElements<
	Els extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	AccTypes extends readonly SqlTypeShape[] = readonly [],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends SqlTypeShape
				? ResolveArrayCtorElements<R, Db, Scope, Params, readonly [...AccTypes, V]>
				: never
		: never
	: InferArrayType<AccTypes>

type InferArrayType<Types extends readonly SqlTypeShape[]> = Types extends readonly []
	? FormatError<Errors["CANNOT_DETERMINE_TYPE_OF_EMPTY_ARRAY"], []>
	: Types extends readonly [infer First extends SqlTypeShape, ...infer Rest extends readonly SqlTypeShape[]]
		? UnifyArrayElementTypes<First, Rest> extends infer Unified extends SqlTypeShape
			? { type: "array"; arg: Unified; nullable: false }
			: never
		: never

type UnifyArrayElementTypes<First extends SqlTypeShape, Rest extends readonly SqlTypeShape[]> = Rest extends readonly []
	? First
	: Rest extends readonly [infer Next extends SqlTypeShape, ...infer Tail extends readonly SqlTypeShape[]]
		? SameComparisonClass<First, Next> extends true
			? UnifyArrayElementTypes<First, Tail>
			: SqlUnknown
		: never

// Parse expression to AST to be resolved later when `FROM` scope is known (`OR` … `AND` … `NOT` … comparisons … arithmetic).

type ValidateInListElement<
	L extends SqlTypeShape,
	R extends SqlTypeShape,
	LAst = never,
	RAst = never,
> = L["type"] extends "null"
	? never
	: R["type"] extends "null"
		? FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>
		: SameComparisonClass<L, R, LAst, RAst> extends true
			? true
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_LIST"], []>

export type ResolveInListItemsAgainstLeft<
	Left extends SqlTypeShape,
	LeftAst,
	Items extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Items extends readonly [infer H extends ScalarExprAst, ...infer Tail extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer Hv
		? Hv extends DbtyperErrorShape
			? Hv
			: Hv extends SqlTypeShape
				? WithEnumCheck<
						EnumComparisonCheck<Db, Left, LeftAst, Hv, H>,
						ValidateInListElement<Left, Hv, LeftAst, H>
					> extends infer V
					? V extends DbtyperErrorShape
						? V
						: V extends true
							? Tail extends readonly []
								? SqlBoolean
								: ResolveInListItemsAgainstLeft<Left, LeftAst, Tail, Db, Scope, Params>
							: never
					: never
				: never
		: never
	: FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>

export type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? Nullable<ColType> // CORE-4: a scalar subquery may return no row
				: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["SCALAR_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["SCALAR_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

type SubSelectColumnAtom<S extends JsqlSelectStatementResult> =
	SingleProjectionColumn<S["returning"]> extends true
		? keyof S["returning"] extends infer K extends keyof S["returning"]
			? S["returning"][K] extends infer ColType extends SqlTypeShape
				? ColType
				: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
			: FormatError<Errors["IN_SUBQUERY_COLUMN_INFERENCE_FAILED"], []>
		: FormatError<Errors["IN_SUBQUERY_MUST_PROJECT_EXACTLY_ONE_COLUMN"], []>

export type ResolveInSubqueryAst<
	Lexpr extends ScalarExprAst,
	Sub extends JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<Lexpr, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? SubSelectColumnAtom<Sub> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Rv extends SqlTypeShape
							? ValidateInListElement<Lv, Rv> extends infer V
								? V extends DbtyperErrorShape
									? V
									: V extends true
										? NullableWhen<Rv["nullable"]> // CORE-2 (#155): NULL when nothing matches and a row is NULL
										: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
								: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
							: never
					: never
				: never
		: never

export type ResolveAnyAllSomeOp<
	_Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst | JsqlSelectStatementResult,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: Lv extends SqlTypeShape
				? R extends JsqlSelectStatementResult
					? SubSelectColumnAtom<R> extends infer Rv
						? Rv extends DbtyperErrorShape
							? Rv
							: Rv extends SqlTypeShape
								? MergeComparison<Lv, Rv> extends infer V
									? V extends DbtyperErrorShape
										? V
										: NullableWhen<Rv["nullable"]> // CORE-2 (#155)
									: never
								: never
						: never
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends DbtyperErrorShape
								? Rv
								: Rv extends SqlTypeShape
									? Rv["type"] extends "array" | "unknown"
										? Rv["arg"] extends { nullable: true }
											? Nullable<SqlBoolean> // CORE-2 (#155): NULL when nothing matches and an element is NULL
											: SqlBoolean
										: Rv extends { type: "param-probe"; arg: infer K extends string | number }
											? ArrayParamProbe<K, Lv> // FN-22, CORE-6 (#163): a parameter is an array of the left type
											: FormatError<Errors["ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY"], []>
									: never
							: never
						: never
				: never
		: never

type NullableWhen<N> = N extends true ? Nullable<SqlBoolean> : SqlBoolean

/** `x = ANY($1)`: the parameter is an array of the type of `x`; nothing when `x` has no type itself. */
type ArrayParamProbe<K extends string | number, Lv extends SqlTypeShape> = Lv["type"] extends
	"null" | "param-probe" | "param-unused" | "unknown"
	? FormatError<Errors["ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY"], []>
	: ParamProbeFound<K, SqlArray<NonNull<Lv>>>
