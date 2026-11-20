import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenEot, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type {
	ExprParseEnv,
	ParseOrScalarUntyped,
	ParseOtherOpScalarUntyped,
	ScalarExprAst,
} from "./parse-expression.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"

type ParseFunctionArgsAccum<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly (ScalarExprAst | { kind: "star" })[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc, Env]
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer R1 extends ParserMonad,
					infer E,
					infer Env1 extends ExprParseEnv,
			  ]
			? E extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, E, Env1>
				: E extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, readonly [...Acc, E], Env1]
						: PeekToken<R1> extends
									TokenKey<"," | "from" | "for"> | TokenIdent<"for"> // `substring(s from 1 for 2)`, `trim(x from y)`
							? ParseFunctionArgsAccum<SkipToken<R1>, Env1, readonly [...Acc, E]>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
									Env1
								>
					: never
			: never

/**
 * The arguments of a call after `(`: the SQL forms `extract(<field> FROM <expr>)` (the field becomes a string
 * argument) and `position(<substring> IN <string>)` (PGT-28, PGT-30), else the plain list.
 */
export type ParseCallArgs<Tokens extends ParserMonad, Parts, Env extends ExprParseEnv> = Parts extends readonly [
	"extract",
]
	? AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Field extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"from">
				? ParseCallArgsTail<SkipToken<R1>, Env, readonly [{ kind: "string"; value: Field }], "from">
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["EXTRACT"]>, Env>
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["EXTRACT"]>, Env>
	: Parts extends readonly ["position"]
		? ParseOtherOpScalarUntyped<Tokens, Env> extends [
				infer R1 extends ParserMonad,
				infer First,
				infer Env1 extends ExprParseEnv,
			]
			? First extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<R1, First, Env1>
				: First extends ScalarExprAst
					? PeekToken<R1> extends TokenKey<"in">
						? ParseCallArgsTail<SkipToken<R1>, Env1, readonly [First], "in">
						: PeekToken<R1> extends TokenKey<",">
							? ParseFunctionArgsAccum<SkipToken<R1>, Env1, readonly [First]>
							: SkipFailedExpressionWithEnv<
									R1,
									FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
									Env1
								>
					: never
			: never
		: Parts extends readonly ["trim"]
			? PeekToken<Tokens> extends TokenIdent<"both" | "leading" | "trailing"> // `trim(both 'x' from s)`
				? ParseFunctionArgs<SkipToken<Tokens>, Env>
				: ParseFunctionArgs<Tokens, Env>
			: Parts extends readonly [infer Name extends string]
				? Lowercase<Name> extends DistinctAggregateName
					? ParseAggregateArgs<Tokens, Env>
					: ParseFunctionArgs<Tokens, Env>
				: ParseFunctionArgs<Tokens, Env>

/** Aggregates that take `DISTINCT` before their arguments (`count(DISTINCT x)`); the result type is the same without it. */
type DistinctAggregateName =
	"count" | "sum" | "avg" | "min" | "max" | "total" | "group_concat" | "string_agg" | "array_agg"

/** `[DISTINCT] args)` of an aggregate; `DISTINCT *` is not SQL. */
type ParseAggregateArgs<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"*">
				? SkipFailedExpressionWithEnv<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["DISTINCT *"]>, Env>
				: ParseFunctionArgs<R1, Env>
			: never
		: ParseFunctionArgs<Tokens, Env>

/** One more expression and the closing `)` of a `FROM` / `IN` call form. */
type ParseCallArgsTail<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[],
	_Kw extends string,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends ParserMonad, infer E, infer Env1 extends ExprParseEnv]
		? E extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E, Env1>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, readonly [...Acc, E], Env1]
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ARGUMENT_LIST"], []>,
							Env1
						>
				: never
		: never

type ParseFunctionArgs<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"*">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<")">
				? [SkipToken<R1>, readonly [{ kind: "star" }], Env]
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_STAR"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, readonly [], Env]
			: ParseFunctionArgsAccum<Tokens, Env, readonly []>

export type ParseOptionalOverClause<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<"filter">
		? ParseFilterClause<Tokens, Env> extends [
				infer RF extends ParserMonad,
				infer FErr,
				infer EnvF extends ExprParseEnv,
			]
			? FErr extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<RF, FErr, EnvF>
				: ParseOverAfterFilter<RF, FnName, Args, EnvF>
			: never
		: ParseOverAfterFilter<Tokens, FnName, Args, Env>

type ParseOverAfterFilter<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"over">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"(">
				? ParseWindowClauseContent<SkipToken<R1>, FnName, Args, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>, Env>
			: never
		: [Tokens, { kind: "function_call"; name: FnName; args: Args }, Env]

/**
 * SQLT-51: `FILTER (WHERE <expr>)` after an aggregate call. Returns `[rest, error or null, env]`. The condition is parsed; it does not change the result type.
 */
type ParseFilterClause<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"(">
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"where">
					? ParseOrScalarUntyped<SkipToken<R2>, Env> extends [
							infer R3 extends ParserMonad,
							infer Cond,
							infer Env3 extends ExprParseEnv,
						]
						? Cond extends DbtyperErrorShape
							? [R3, Cond, Env3]
							: PeekToken<R3> extends TokenKey<")">
								? [SkipToken<R3>, null, Env3]
								: [R3, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, Env3]
						: never
					: [R2, FormatError<Errors["UNEXPECTED_TOKEN"], ["FILTER"]>, Env]
				: never
			: [R1, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_OVER"], []>, Env]
		: never

type ParseWindowClauseContent<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"partition">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"by">
				? ParseWindowPartitionByList<SkipToken<R1>, Env> extends [
						infer R2 extends ParserMonad,
						infer PartitionList,
						infer Env2 extends ExprParseEnv,
					]
					? PartitionList extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R2, PartitionList, Env2>
						: PartitionList extends readonly ScalarExprAst[]
							? PeekToken<R2> extends TokenKey<"order">
								? ParseWindowOrderByAfterPartition<R2, FnName, Args, PartitionList, Env2>
								: PeekToken<R2> extends TokenKey<")">
									? [
											SkipToken<R2>,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
											Env2,
										]
									: CloseWindowOrError<
											R2,
											{
												kind: "window_function"
												name: FnName
												args: Args
												over: { partition_by: PartitionList; order_by: readonly [] }
											},
											Env2,
											FormatError<
												Errors["EXPECTED_ORDER_BY_OR_CLOSE_PAREN_AFTER_PARTITION_BY"],
												[]
											>
										>
							: never
					: never
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_BY_AFTER_PARTITION"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"order">
			? ParseWindowOrderByWithoutPartition<Tokens, FnName, Args, Env>
			: CloseWindowOrError<
					Tokens,
					{ kind: "window_function"; name: FnName; args: Args; over: { order_by: readonly [] } },
					Env,
					FormatError<Errors["EXPECTED_PARTITION_BY_OR_ORDER_BY_IN_OVER_CLAUSE"], []>
				>

/**
 * An empty `OVER ()` and a frame (`ROWS|RANGE|GROUPS …`, skipped: it does not change a result type) before the closing
 * paren. One rule for every dialect (SQLT-51, PGT-3, #118): PostgreSQL and SQLite both accept them.
 */
type CloseWindowOrError<Tokens extends ParserMonad, Ast, Env extends ExprParseEnv, Err extends DbtyperErrorShape> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Ast, Env]
		: AsIdent<PeekToken<Tokens>> extends TokenIdent<"range" | "groups">
			? CloseWindowFrame<Tokens, Ast, Env, Err>
			: PeekToken<Tokens> extends TokenKey<"rows">
				? CloseWindowFrame<Tokens, Ast, Env, Err>
				: SkipFailedExpressionWithEnv<Tokens, Err, Env>

type CloseWindowFrame<Tokens extends ParserMonad, Ast, Env extends ExprParseEnv, Err extends DbtyperErrorShape> =
	SkipToCloseParen<Tokens> extends [infer Rf extends ParserMonad, unknown]
		? PeekToken<Rf> extends TokenKey<")">
			? [SkipToken<Rf>, Ast, Env]
			: SkipFailedExpressionWithEnv<Rf, Err, Env>
		: never

type SkipToCloseParen<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<")"> | TokenEot
		? [Tokens, null]
		: SkipToken<Tokens> extends infer Next extends ParserMonad
			? SkipToCloseParen<Next>
			: never

type ParseWindowOrderByWithoutPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { order_by: OrderList }
									},
									Env4,
								]
							: CloseWindowOrError<
									R4,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { order_by: OrderList }
									},
									Env4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER_IN_OVER_CLAUSE"], []>, Env>
		: never

type ParseWindowOrderByAfterPartition<
	Tokens extends ParserMonad,
	FnName extends string,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	PartitionList extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	SkipToken<Tokens> extends infer R3 extends ParserMonad
		? PeekToken<R3> extends TokenKey<"by">
			? ParseWindowOrderByList<SkipToken<R3>, Env> extends [
					infer R4 extends ParserMonad,
					infer OrderList,
					infer Env4 extends ExprParseEnv,
				]
				? OrderList extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R4, OrderList, Env4>
					: OrderList extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[]
						? PeekToken<R4> extends TokenKey<")">
							? [
									SkipToken<R4>,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { partition_by: PartitionList; order_by: OrderList }
									},
									Env4,
								]
							: CloseWindowOrError<
									R4,
									{
										kind: "window_function"
										name: FnName
										args: Args
										over: { partition_by: PartitionList; order_by: OrderList }
									},
									Env4,
									FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_OVER_CLAUSE"], []>
								>
						: never
				: never
			: SkipFailedExpressionWithEnv<R3, FormatError<Errors["EXPECTED_BY_AFTER_ORDER"], []>, Env>
		: never

type ParseWindowPartitionByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<",">
					? ParseWindowPartitionByList<SkipToken<R1>, Env1, readonly [...Acc, Expr]>
					: [R1, readonly [...Acc, Expr], Env1]
				: never
		: never

type ParseWindowOrderByList<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[] = readonly [],
> =
	ParseOrScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Expr,
		infer Env1 extends ExprParseEnv,
	]
		? Expr extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Expr, Env1>
			: Expr extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<"asc">
					? ParseWindowOrderByListTail<
							SkipToken<R1>,
							Env1,
							readonly [...Acc, { expr: Expr; direction: "asc" }]
						>
					: PeekToken<R1> extends TokenKey<"desc">
						? ParseWindowOrderByListTail<
								SkipToken<R1>,
								Env1,
								readonly [...Acc, { expr: Expr; direction: "desc" }]
							>
						: ParseWindowOrderByListTail<R1, Env1, readonly [...Acc, { expr: Expr; direction: null }]>
				: never
		: never

type ParseWindowOrderByListTail<
	Tokens extends ParserMonad,
	Env extends ExprParseEnv,
	Acc extends readonly { expr: ScalarExprAst; direction: "asc" | "desc" | null }[],
> = PeekToken<Tokens> extends TokenKey<","> ? ParseWindowOrderByList<SkipToken<Tokens>, Env, Acc> : [Tokens, Acc, Env]
