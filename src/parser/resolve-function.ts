import type { DialectFact, FunctionCatalogFacts, OtherDialectTitle } from "../core/dialect.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { SqlTypeShape, SqlUnknown } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type {
	CatalogRow,
	IsCatalogFunction,
	IsTableRow,
	IsWindowCapableRow,
	IsWindowOnlyRow,
} from "./function-catalog.ts"
import type { CatalogArityError } from "./function-catalog-arity.ts"
import type { CatalogRowResult } from "./function-catalog-result.ts"
import type { EnumPeerCheck } from "./parse-enum-checks.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"

type ResolveFunctionArgsList<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Acc extends readonly SqlTypeShape[] = [],
> = Args extends readonly [infer First, ...infer Rest extends readonly (ScalarExprAst | { kind: "star" })[]]
	? First extends { kind: "star" }
		? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, SqlUnknown]>
		: First extends ScalarExprAst
			? ResolveExpressionAST<First, Db, Scope, Params> extends infer Res
				? Res extends DbtyperErrorShape
					? Res
					: Res extends SqlTypeShape
						? ResolveFunctionArgsList<Rest, Db, Scope, Params, readonly [...Acc, Res]>
						: never
				: never
			: never
	: Acc

type ArgsTupleContainsStar<Args extends readonly (ScalarExprAst | { kind: "star" })[]> = Args extends readonly [
	infer Head,
	...infer Tail extends readonly (ScalarExprAst | { kind: "star" })[],
]
	? Head extends { kind: "star" }
		? true
		: ArgsTupleContainsStar<Tail>
	: false

/**
 * SQLT-44…SQLT-52, PGT-27…PGT-33, FN-19…FN-21: a call in a chain, typed from its row in the function catalog of the
 * dialect (`functionCatalog`, src/parser/function-catalog.ts): argument count, window rules, result type and
 * nullability are columns of the row. A name that is not in the catalog is FN-1 (with the other dialect's hint,
 * SQLT-52, PGT-34). `Windowed`: the call has an OVER clause. `InFrom`: the call is a FROM item; a table-valued
 * function (kind "table") is one only there, elsewhere it is unknown (SQLT-72); in FROM its result is no value
 * (`SqlUnknown`): the FROM parser takes its columns from the catalog's `tables`.
 */
type ResolveCatalogFunctionCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Windowed extends boolean,
	InFrom extends boolean,
	L extends string = Lowercase<Name>,
	C extends FunctionCatalogFacts = DialectFact<Db, "functionCatalog">,
> =
	IsCatalogFunction<C, L> extends true
		? IsTableRow<CatalogRow<C, L, Args["length"]>> extends InFrom
			? ResolveCatalogRowCall<Name, Args, Db, Scope, Params, Windowed, L, C>
			: UnknownFunction<Db, C, Name, L>
		: UnknownFunction<Db, C, Name, L>

/** {@link ResolveCatalogFunctionCall} of a name that is in the catalog, in a position its kind allows. */
type ResolveCatalogRowCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Windowed extends boolean,
	L extends string,
	C extends FunctionCatalogFacts,
> =
	ArgsTupleContainsStar<Args> extends true
		? L extends "count"
			? CatalogRowResult<C, CatalogRow<C, "count", 0>, []>
			: FormatError<Errors["STAR_IS_ONLY_ALLOWED_AS_COUNT_STAR_ARGUMENT"], []>
		: ResolveFunctionArgsList<Args, Db, Scope, Params> extends infer ArgsRes
			? ArgsRes extends DbtyperErrorShape
				? ArgsRes
				: ArgsRes extends readonly SqlTypeShape[]
					? CatalogRow<C, L, ArgsRes["length"]> extends infer Row
						? CatalogArityError<Row, ArgsRes, L> extends infer Arity
							? Arity extends DbtyperErrorShape
								? Arity
								: IsTableRow<Row> extends true
									? SqlUnknown
									: EnumPeerCheck<Db, L, ArgsRes, Args> extends infer Peer extends DbtyperErrorShape
										? Peer
										: Windowed extends false
											? IsWindowOnlyRow<Row> extends true
												? FormatError<Errors["WINDOW_FUNCTION_REQUIRES_OVER_CLAUSE"], [Name]>
												: CatalogRowResult<C, Row, ArgsRes>
											: IsWindowCapableRow<Row> extends true
												? CatalogRowResult<C, Row, ArgsRes>
												: UnknownFunction<Db, C, Name, L>
							: never
						: never
					: never
			: never

type PgHint<Hint extends string> = Hint extends "" ? "" : `; ${Hint}`

/** FN-1; SQLT-52, PGT-34: a name of the other dialect's catalog names its replacement. */
type UnknownFunction<
	Db,
	C extends FunctionCatalogFacts,
	Name extends string,
	L extends string,
> = L extends keyof C["hints"]
	? C["hints"][L] extends infer Hint extends string
		? FormatError<
				Errors["UNKNOWN_FUNCTION"],
				[Hint extends "" ? Name : `${Name}. ${Name}() is ${OtherDialectTitle<Db>}-only${PgHint<Hint>}`]
			>
		: never
	: FormatError<Errors["UNKNOWN_FUNCTION"], [Name]>

/** CORE-2, CORE-3: nullability of a function call on top of its base result type. */
export type ResolveFunctionCall<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	InFrom extends boolean = false,
	L extends string = Lowercase<Name>,
> = ResolveCatalogFunctionCall<Name, Args, Db, Scope, Params, false, InFrom, L>

export type ResolveWindowFunction<
	Name extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	L extends string = Lowercase<Name>,
> = ResolveCatalogFunctionCall<Name, Args, Db, Scope, Params, true, false, L>

/**
 * FN-30 (#216): the columns of an inline `OVER (PARTITION BY … ORDER BY … frame)` resolve against the FROM scope, as
 * the columns of a WINDOW definition do (the spec comes from the one window-spec parser). `null` when all resolve
 * (and for `OVER w`, which has none); else the first error.
 */
export type WindowSpecResolveError<
	Over,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Over extends {
	partition_by: infer P extends readonly ScalarExprAst[]
	order_by: infer O extends readonly { expr: ScalarExprAst }[]
	frame: infer F
}
	? FirstExprError<
			readonly [
				...P,
				...{ [I in keyof O]: O[I]["expr"] },
				...(F extends readonly ScalarExprAst[] ? F : readonly []),
			],
			Db,
			Scope,
			Params
		>
	: null

type FirstExprError<
	Exprs extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Exprs extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
		? R extends DbtyperErrorShape
			? R
			: FirstExprError<T, Db, Scope, Params>
		: never
	: null
