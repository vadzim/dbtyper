import type { ShapeComparisonClass, SqlComparisonClass, StringLiteralClasses } from "../core/comparison-classes.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { Nullable, SqlBoolean, SqlNull, SqlText, SqlTypeShape, SqlUnknown } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { EnumComparisonCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type {
	EmptyExpressionParams,
	EnumBetweenCheck,
	ExpressionParamsShape,
	ScalarCmpOp,
	ScalarExprAst,
	ScalarIdentParts,
	SingleProjectionColumn,
} from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveCastForDialect, SqlCastTypeNorm, WithCastLabelCheck } from "./resolve-cast.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"
import type { ApplyOperandNullability, ParamProbeAt } from "./resolve-expression-params.ts"
import type { ResolveFunctionCall, ResolveWindowFunction } from "./resolve-function.ts"
import type {
	IsSqlBooleanType,
	IsSqlTextType,
	MergeBoolBinary,
	MergeBoolNot,
	NumberLiteralType,
	ResolveCustomOp,
	ResolveScalarExprAstNeg,
	ResolveScalarExprAstPair,
} from "./resolve-operators.ts"

type ResolveArrayCtorElements<
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

/** Resolve after `FROM` scope is known */
type ExpressionResolvers<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = {
	true: SqlBoolean
	false: SqlBoolean
	sql_null: SqlNull
	string: Ast extends { kind: "string"; value: string }
		? Ast extends { blob: true }
			? { type: "blob"; arg: null; nullable: false } // SQLT-29
			: SqlText
		: never
	number: Ast extends { kind: "number"; raw: infer Raw extends string } ? NumberLiteralType<Db, Raw> : never
	param: Ast extends { kind: "param"; name: infer N extends string } ? LookupParam<Params, N> : never
	"positional-param": Ast extends { kind: "positional-param"; index: infer I extends number }
		? LookupPositionalParam<Params, I>
		: never
	custom_op: Ast extends {
		kind: "custom_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveCustomOp<Op, L, R, Db, Scope, Params>
		: never
	exp: Ast extends { kind: "exp"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	mod: Ast extends { kind: "mod"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	function_call: Ast extends {
		kind: "function_call"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
	}
		? ResolveFunctionCall<FnName, FArgs, Db, Scope, Params>
		: never
	window_function: Ast extends {
		kind: "window_function"
		name: infer FnName extends string
		args: infer FArgs extends readonly (ScalarExprAst | { kind: "star" })[]
		over: infer _Over
	}
		? ResolveWindowFunction<FnName, FArgs, Db, Scope, Params>
		: never
	qualified_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	alias_table_star: FormatError<Errors["QUALIFIED_TABLE_STAR_IS_ONLY_VALID_IN_SELECT_LISTS"], []>
	array_ctor: Ast extends {
		kind: "array_ctor"
		elements: infer Els extends readonly ScalarExprAst[]
	}
		? ResolveArrayCtorElements<Els, Db, Scope, Params>
		: never
	array_index: Ast extends {
		kind: "array_index"
		base: infer B extends ScalarExprAst
		index: infer I extends ScalarExprAst
	}
		? ResolveExpressionAST<B, Db, Scope, Params> extends infer Lv
			? Lv extends DbtyperErrorShape
				? Lv
				: ResolveExpressionAST<I, Db, Scope, Params> extends infer Rv
					? Rv extends DbtyperErrorShape
						? Rv
						: Lv extends SqlTypeShape
							? Rv extends SqlTypeShape
								? SqlUnknown
								: never
							: never
					: never
			: never
		: never
	col: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? ResolveIdentChainValue<Db, Scope, P>
		: never
	neg: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
		? ResolveScalarExprAstNeg<I, Db, Scope, Params>
		: never
	mul: Ast extends {
		kind: "mul"
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params>
		: never
	add: Ast extends {
		kind: "add"
		left: infer La extends ScalarExprAst
		right: infer Ra extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<La, Ra, Db, Scope, Params, "add">
		: never
	sub: Ast extends {
		kind: "sub"
		left: infer Ls extends ScalarExprAst
		right: infer Rs extends ScalarExprAst
	}
		? ResolveScalarExprAstPair<Ls, Rs, Db, Scope, Params, "sub">
		: never
	not: Ast extends { kind: "not"; inner: infer I extends ScalarExprAst }
		? ResolveExpressionAST<I, Db, Scope, Params> extends infer V
			? MergeBoolNot<V>
			: never
		: never
	and: Ast extends { kind: "and"; left: infer La extends ScalarExprAst; right: infer Ra extends ScalarExprAst }
		? ResolveExpressionAST<La, Db, Scope, Params> extends infer Lv
			? ResolveExpressionAST<Ra, Db, Scope, Params> extends infer Rv
				? MergeBoolBinary<Lv, Rv, "AND_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	or: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
		? ResolveExpressionAST<Lo, Db, Scope, Params> extends infer Lv2
			? ResolveExpressionAST<Ro, Db, Scope, Params> extends infer Rv2
				? MergeBoolBinary<Lv2, Rv2, "OR_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	cmp: Ast extends {
		kind: "cmp"
		op: infer _Op extends ScalarCmpOp
		left: infer Lc extends ScalarExprAst
		right: infer Rc extends ScalarExprAst
	}
		? ResolveExpressionAST<Lc, Db, Scope, Params> extends infer LcV
			? ResolveExpressionAST<Rc, Db, Scope, Params> extends infer RcV
				? LcV extends DbtyperErrorShape
					? LcV
					: RcV extends DbtyperErrorShape
						? RcV
						: LcV extends SqlTypeShape
							? RcV extends SqlTypeShape
								? WithEnumCheck<
										EnumComparisonCheck<Db, LcV, Lc, RcV, Rc>,
										MergeComparison<LcV, RcV, Lc, Rc>
									>
								: never
							: never
				: never
			: never
		: never
	is_cmp: Ast extends { kind: "is_cmp"; left: infer Li extends ScalarExprAst; right: infer Ri extends ScalarExprAst }
		? ResolveExpressionAST<Li, Db, Scope, Params> extends infer LiV
			? LiV extends DbtyperErrorShape
				? LiV
				: ResolveExpressionAST<Ri, Db, Scope, Params> extends infer RiV
					? RiV extends DbtyperErrorShape
						? RiV
						: SqlBoolean
					: never
			: never
		: never
	is_null: Ast extends { kind: "is_null"; expr: infer E0 extends ScalarExprAst }
		? ResolveExpressionAST<E0, Db, Scope, Params> extends infer V0
			? V0 extends DbtyperErrorShape
				? V0
				: V0 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends DbtyperErrorShape
				? V1
				: V1 extends SqlTypeShape
					? SqlBoolean
					: never
			: never
		: never
	pg_cast: Ast extends {
		kind: "pg_cast"
		expr: infer Exc extends ScalarExprAst
		type_parts: infer Ptc extends readonly string[]
	}
		? ResolveExpressionAST<Exc, Db, Scope, Params> extends infer Evc
			? Evc extends DbtyperErrorShape
				? Evc
				: Evc extends SqlTypeShape
					? SqlCastTypeNorm<Ptc> extends infer Normc extends string
						? WithCastLabelCheck<Db, ResolveCastForDialect<Db, Evc, Normc>, Exc>
						: never
					: never
			: never
		: never
	sql_cast: Ast extends {
		kind: "sql_cast"
		expr: infer Exs extends ScalarExprAst
		type_parts: infer Pts extends readonly string[]
	}
		? ResolveExpressionAST<Exs, Db, Scope, Params> extends infer Evs
			? Evs extends DbtyperErrorShape
				? Evs
				: Evs extends SqlTypeShape
					? SqlCastTypeNorm<Pts> extends infer Norms extends string
						? WithCastLabelCheck<Db, ResolveCastForDialect<Db, Evs, Norms>, Exs>
						: never
					: never
			: never
		: never
	between: Ast extends {
		kind: "between"
		expr: infer Eb extends ScalarExprAst
		low: infer Lb extends ScalarExprAst
		high: infer Hb extends ScalarExprAst
	}
		? ResolveExpressionAST<Eb, Db, Scope, Params> extends infer EvB
			? EvB extends DbtyperErrorShape
				? EvB
				: ResolveExpressionAST<Lb, Db, Scope, Params> extends infer LvB
					? LvB extends DbtyperErrorShape
						? LvB
						: ResolveExpressionAST<Hb, Db, Scope, Params> extends infer HvB
							? HvB extends DbtyperErrorShape
								? HvB
								: EvB extends SqlTypeShape
									? LvB extends SqlTypeShape
										? HvB extends SqlTypeShape
											? WithEnumCheck<
													EnumBetweenCheck<Db, EvB, Eb, LvB, Lb, HvB, Hb>,
													MergeBetweenBounds<EvB, LvB, HvB, Eb, Lb, Hb>
												>
											: never
										: never
									: never
							: never
					: never
			: never
		: never
	like: Ast extends {
		kind: "like"
		expr: infer Exl extends ScalarExprAst
		pattern: infer Pl extends ScalarExprAst
		case_insensitive: infer _CI extends boolean
	}
		? ResolveExpressionAST<Exl, Db, Scope, Params> extends infer EvL
			? EvL extends DbtyperErrorShape
				? EvL
				: ResolveExpressionAST<Pl, Db, Scope, Params> extends infer PvL
					? PvL extends DbtyperErrorShape
						? PvL
						: EvL extends SqlTypeShape
							? PvL extends SqlTypeShape
								? MergeLikeOperands<EvL, PvL>
								: never
							: never
					: never
			: never
		: never
	pg_regex_match: Ast extends {
		kind: "pg_regex_match"
		expr: infer Exr extends ScalarExprAst
		pattern: infer Pr extends ScalarExprAst
		case_insensitive: infer _CR extends boolean
	}
		? ResolveExpressionAST<Exr, Db, Scope, Params> extends infer EvR
			? EvR extends DbtyperErrorShape
				? EvR
				: ResolveExpressionAST<Pr, Db, Scope, Params> extends infer PvR
					? PvR extends DbtyperErrorShape
						? PvR
						: EvR extends SqlTypeShape
							? PvR extends SqlTypeShape
								? MergeLikeOperands<EvR, PvR>
								: never
							: never
					: never
			: never
		: never
	case_simple: Ast extends {
		kind: "case_simple"
		discriminant: infer Dsc extends ScalarExprAst
		arms: infer ArmsS extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer ElS extends ScalarExprAst | null
	}
		? ResolveCaseSimple<Dsc, ArmsS, ElS, Db, Scope, Params>
		: never
	case_searched: Ast extends {
		kind: "case_searched"
		arms: infer Arms extends readonly {
			when: ScalarExprAst
			then: ScalarExprAst
		}[]
		else_: infer Elc extends ScalarExprAst | null
	}
		? ResolveCaseSearched<Arms, Elc, Db, Scope, Params>
		: never
	exists_subquery: Ast extends {
		kind: "exists_subquery"
		sub: infer _Ex extends JsqlSelectStatementResult
	}
		? SqlBoolean
		: never
	scalar_subquery: Ast extends {
		kind: "scalar_subquery"
		sel: infer Sel extends JsqlSelectStatementResult
	}
		? ResolveScalarSubquerySel<Sel>
		: never
	in_subquery: Ast extends {
		kind: "in_subquery"
		expr: infer Ie extends ScalarExprAst
		sub: infer Isub extends JsqlSelectStatementResult
	}
		? ResolveInSubqueryAst<Ie, Isub, Db, Scope, Params>
		: never
	any_op: Ast extends {
		kind: "any_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	all_op: Ast extends {
		kind: "all_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	some_op: Ast extends {
		kind: "some_op"
		op: infer Op extends string
		left: infer L extends ScalarExprAst
		right: infer R extends ScalarExprAst | JsqlSelectStatementResult
	}
		? ResolveAnyAllSomeOp<Op, L, R, Db, Scope, Params>
		: never
	in_list: Ast extends {
		kind: "in_list"
		expr: infer Eln extends ScalarExprAst
		items: infer Ins extends readonly ScalarExprAst[]
	}
		? ResolveExpressionAST<Eln, Db, Scope, Params> extends infer LvIn
			? LvIn extends DbtyperErrorShape
				? LvIn
				: LvIn extends SqlTypeShape
					? ResolveInListItemsAgainstLeft<LvIn, Eln, Ins, Db, Scope, Params>
					: never
			: never
		: never
}

export type ResolveExpressionAST<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Ast extends { kind: infer K extends keyof ExpressionResolvers<any, any, any, any> }
	? ParamProbeAt<Ast, Db, Scope, Params> extends infer Probed
		? [Probed] extends [never]
			? ApplyOperandNullability<Ast, ExpressionResolvers<Ast, Db, Scope, Params>[K], Db, Scope, Params>
			: Probed
		: never
	: never

/** Longest `a` / `a.b` / `a.b.c` chain starting at an identifier (used by SELECT list fast path).
 * Also recognizes `alias.*` and `schema.table.*` via sentinel tuples `["__ats__", alias]` / `["__qts__", sch, tab]`.
 */
export type MaximalIdentChain<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends infer T1
		? AsIdent<T1> extends TokenIdent<infer A extends string>
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<".">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"*">
							? SkipToken<R2> extends infer R3 extends ParserMonad
								? [R3, readonly ["__ats__", A], ""]
								: never
							: PeekToken<R2> extends infer T2
								? AsIdent<T2> extends TokenIdent<infer B extends string>
									? SkipToken<R2> extends infer R3 extends ParserMonad
										? PeekToken<R3> extends TokenKey<".">
											? SkipToken<R3> extends infer R4 extends ParserMonad
												? PeekToken<R4> extends TokenKey<"*">
													? SkipToken<R4> extends infer R5 extends ParserMonad
														? [R5, readonly ["__qts__", A, B], ""]
														: never
													: PeekToken<R4> extends infer T4
														? AsIdent<T4> extends TokenIdent<infer C extends string>
															? SkipToken<R4> extends infer R5 extends ParserMonad
																? [R5, readonly [A, B, C], WrittenOf<T4>]
																: never
															: never
														: never
												: never
											: [R3, readonly [A, B], WrittenOf<T2>]
										: never
									: never
								: never
						: never
					: [R1, readonly [A], WrittenOf<T1>]
				: never
			: never
		: never

/** SQLite (SQLT-28): how an identifier token was written in the query; "" when the token does not say. */
type WrittenOf<T> = T extends { written: infer W extends string } ? W : ""

export type LookupParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? Params[Name]
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

export type LookupPositionalParam<
	Params extends ExpressionParamsShape,
	Index extends number,
> = Params extends readonly SqlTypeShape[]
	? // PARAM-13: for a tuple (`["a"]`) an index beyond its length is out of bounds; a plain array has no known length
		number extends Params["length"]
		? Params[number]
		: `${Index}` extends keyof Params
			? Params[Index]
			: FormatError<Errors["POSITIONAL_PARAMETER_OUT_OF_BOUNDS"], [Index]>
	: FormatError<Errors["POSITIONAL_PARAMETER_REQUIRES_ARRAY"], []>

type ResolveIdentChainValue<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> =
	ResolveColumnRefValue<Db, Scope, Parts> extends infer V
		? V extends DbtyperErrorShape
			? V
			: V extends { sql: infer Sql extends SqlTypeShape }
				? Sql
				: never
		: never

/** PGT-16: `Ast` is an untyped string literal and `Other` is of a class that takes one without a cast. */
type StringLiteralFits<Ast, Other extends SqlTypeShape> = [Ast] extends [never]
	? false
	: Ast extends { kind: "string"; blob: true }
		? false
		: Ast extends { kind: "string" }
			? ShapeComparisonClass<Other> extends StringLiteralClasses
				? true
				: false
			: false

/**
 * EXPR-26: two operands are compatible when their classes are equal or either is "unknown", or one is an untyped
 * string literal (its AST, when the caller has it) and the other a class that takes one (PGT-16).
 */
export type SameComparisonClass<
	SqlL extends string | SqlTypeShape,
	SqlR extends string | SqlTypeShape,
	AstL = never,
	AstR = never,
> = SqlL extends SqlTypeShape
	? SqlR extends SqlTypeShape
		? ShapeComparisonClass<SqlL> extends "unknown"
			? true
			: ShapeComparisonClass<SqlR> extends "unknown"
				? true
				: ShapeComparisonClass<SqlL> extends ShapeComparisonClass<SqlR>
					? true
					: StringLiteralFits<AstL, SqlR> extends true
						? true
						: StringLiteralFits<AstR, SqlL>
		: false
	: SqlR extends SqlTypeShape
		? false
		: SqlL extends string
			? SqlR extends string
				? SqlComparisonClass<SqlL> extends "unknown"
					? true
					: SqlComparisonClass<SqlR> extends "unknown"
						? true
						: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
							? true
							: false
				: false
			: false

type MergeComparison<
	L extends SqlTypeShape,
	R extends SqlTypeShape,
	LAst = never,
	RAst = never,
> = L["type"] extends "null"
	? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
	: R["type"] extends "null"
		? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
		: SameComparisonClass<L, R, LAst, RAst> extends true
			? SqlBoolean
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_COMPARISON"], []>

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */
type ValidateCaseSimpleWhenMatch<
	Disc extends SqlTypeShape,
	WhenV extends SqlTypeShape,
	DiscAst = never,
	WhenAst = never,
> = MergeComparison<Disc, WhenV, DiscAst, WhenAst> extends infer M extends DbtyperErrorShape ? M : true

type MergeBetweenBounds<
	E extends SqlTypeShape,
	Lm extends SqlTypeShape,
	H extends SqlTypeShape,
	EAst = never,
	LmAst = never,
	HAst = never,
> = E["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
	: Lm["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
		: H["type"] extends "null"
			? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
			: SameComparisonClass<E, Lm, EAst, LmAst> extends true
				? SameComparisonClass<E, H, EAst, HAst> extends true
					? SqlBoolean
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>
				: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>

type MergeLikeOperands<Expr extends SqlTypeShape, Pat extends SqlTypeShape> = Expr["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
	: Pat["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
		: IsSqlTextType<Expr> extends true
			? IsSqlTextType<Pat> extends true
				? SqlBoolean
				: FormatError<Errors["LIKE_PATTERN_MUST_BE_TEXT"], []>
			: FormatError<Errors["LIKE_LEFT_OPERAND_MUST_BE_TEXT"], []>

/** CORE-2, CORE-5: a CASE result is nullable when any branch is (a NULL literal branch included). */
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
				? IsSqlBooleanType<Wv> extends true
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
					: FormatError<Errors["CASE_WHEN_MUST_BE_BOOLEAN"], []>
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

type ResolveCaseSearched<
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

type ResolveCaseSimple<
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

type ResolveInListItemsAgainstLeft<
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

type ResolveScalarSubquerySel<S extends JsqlSelectStatementResult> =
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

type ResolveInSubqueryAst<
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
										? SqlBoolean
										: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
								: FormatError<Errors["INCOMPATIBLE_TYPES_IN_IN_SUBQUERY"], []>
							: never
					: never
				: never
		: never

type ResolveAnyAllSomeOp<
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
										: SqlBoolean
									: never
								: never
						: never
					: R extends ScalarExprAst
						? ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
							? Rv extends DbtyperErrorShape
								? Rv
								: Rv extends SqlTypeShape
									? Rv["type"] extends "array" | "unknown"
										? SqlBoolean
										: FormatError<Errors["ANY_ALL_SOME_REQUIRES_ARRAY_OR_SUBQUERY"], []>
									: never
							: never
						: never
				: never
		: never
