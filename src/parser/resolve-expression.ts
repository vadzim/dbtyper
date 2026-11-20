import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { SqlBoolean, SqlNull, SqlText, SqlTypeShape, SqlUnknown } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { EnumComparisonCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ScalarCmpOp,
	ScalarExprAst,
	ScalarIdentParts,
} from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveCastForDialect, SqlCastTypeNorm, WithCastLabelCheck } from "./resolve-cast.ts"
import type { ResolveCaseSearched, ResolveCaseSimple } from "./resolve-expression-case.ts"
import type {
	ResolveAnyAllSomeOp,
	ResolveArrayCtorElements,
	ResolveInListItemsAgainstLeft,
	ResolveInSubqueryAst,
	ResolveScalarSubquerySel,
} from "./resolve-expression-collections.ts"
import type {
	MergeComparison,
	ResolveBetweenAst,
	ResolveLikeAst,
	ResolvePgRegexMatchAst,
} from "./resolve-expression-compare.ts"
import type { LookupParam, LookupPositionalParam, ResolveIdentChainValue } from "./resolve-expression-ident.ts"
import type { ApplyOperandNullability, NullTestedParam, ParamProbeAt } from "./resolve-expression-params.ts"
import type { ResolveFunctionCall, ResolveWindowFunction } from "./resolve-function.ts"
import type {
	MergeBoolBinary,
	MergeBoolNot,
	NumberLiteralType,
	ResolveCustomOp,
	ResolveScalarExprAstNeg,
	ResolveScalarExprAstPair,
} from "./resolve-operators.ts"

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
		? ResolveScalarExprAstPair<L, R, Db, Scope, Params, "mul">
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
			? MergeBoolNot<Db, V>
			: never
		: never
	and: Ast extends { kind: "and"; left: infer La extends ScalarExprAst; right: infer Ra extends ScalarExprAst }
		? ResolveExpressionAST<La, Db, Scope, Params> extends infer Lv
			? ResolveExpressionAST<Ra, Db, Scope, Params> extends infer Rv
				? MergeBoolBinary<Db, Lv, Rv, "AND_OPERANDS_MUST_BE_BOOLEAN">
				: never
			: never
		: never
	or: Ast extends { kind: "or"; left: infer Lo extends ScalarExprAst; right: infer Ro extends ScalarExprAst }
		? ResolveExpressionAST<Lo, Db, Scope, Params> extends infer Lv2
			? ResolveExpressionAST<Ro, Db, Scope, Params> extends infer Rv2
				? MergeBoolBinary<Db, Lv2, Rv2, "OR_OPERANDS_MUST_BE_BOOLEAN">
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
					? NullTestedParam<E0, V0>
					: never
			: never
		: never
	is_not_null: Ast extends { kind: "is_not_null"; expr: infer E1 extends ScalarExprAst }
		? ResolveExpressionAST<E1, Db, Scope, Params> extends infer V1
			? V1 extends DbtyperErrorShape
				? V1
				: V1 extends SqlTypeShape
					? NullTestedParam<E1, V1>
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
	between: ResolveBetweenAst<Ast, Db, Scope, Params>
	like: ResolveLikeAst<Ast, Db, Scope, Params>
	pg_regex_match: ResolvePgRegexMatchAst<Ast, Db, Scope, Params>
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

export type { SameComparisonClass } from "./resolve-expression-compare.ts"
export type { LookupParam, LookupPositionalParam } from "./resolve-expression-ident.ts"
