import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	ParamProbeFound,
	ParamUnresolved,
	ProbeBinding,
	ProbeKeyOf,
	ProbeTypeFromPeer,
} from "../core/param-probe.ts"
import type { Nullable, SqlText, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Inc } from "../core/type-utils.ts"
import type { DbtyperErrorShape } from "../dbtyper-error.ts"
import type { CatalogRow, IsPeerTypedRow, RowArgType } from "./function-catalog.ts"
import type { ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveCastFromShape, SqlCastTypeNorm } from "./resolve-cast.ts"
import type { LookupParam, LookupPositionalParam, ResolveExpressionAST } from "./resolve-expression.ts"

/** Operands of an operator that must have one type, and whether that type has to be numeric. */
type SharedTypeOperands<Ast> = Ast extends {
	kind: "add" | "sub" | "mul" | "exp" | "mod"
	left: infer L extends ScalarExprAst
	right: infer R extends ScalarExprAst
}
	? { ops: readonly [L, R]; numeric: true }
	: Ast extends { kind: "cmp" | "is_cmp"; left: infer L extends ScalarExprAst; right: infer R extends ScalarExprAst }
		? { ops: readonly [L, R]; numeric: false }
		: Ast extends {
					kind: "like" | "pg_regex_match"
					expr: infer E extends ScalarExprAst
					pattern: infer P extends ScalarExprAst
			  }
			? { ops: readonly [E, P]; numeric: false }
			: Ast extends {
						kind: "between"
						expr: infer E extends ScalarExprAst
						low: infer Lo extends ScalarExprAst
						high: infer Hi extends ScalarExprAst
				  }
				? { ops: readonly [E, Lo, Hi]; numeric: false }
				: Ast extends {
							kind: "in_list"
							expr: infer E extends ScalarExprAst
							items: infer Its extends readonly ScalarExprAst[]
					  }
					? { ops: readonly [E, ...Its]; numeric: false }
					: never

/** The probe key of a parameter operand that has no type yet, `never` for anything else. */
type ParamOperandProbeKey<Op, Params extends ExpressionParamsShape> = Op extends {
	kind: "param"
	name: infer N extends string
}
	? ProbeKeyOf<LookupParam<Params, N>>
	: Op extends { kind: "positional-param"; index: infer I extends number }
		? ProbeKeyOf<LookupPositionalParam<Params, I>>
		: never

type AllParamOperands<Ops extends readonly unknown[]> = Ops extends readonly [infer H, ...infer T]
	? H extends { kind: "param" | "positional-param" }
		? AllParamOperands<T>
		: false
	: true

/** The type of the first operand that resolves to a real type (a bound parameter counts, #145) (and a numeric one if asked). */
type PeerOperandType<
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Ops extends readonly [infer H, ...infer T]
	? H extends ScalarExprAst
		? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
			? R extends SqlTypeShape
				? R["type"] extends "null" | "param-probe" | "param-unused" | "param-read-probe"
					? PeerOperandType<T, Db, Scope, Params, Numeric>
					: Numeric extends true
						? R["type"] extends "integer" | "bigint" | "smallint" | "numeric" | "real" | "double precision"
							? R
							: PeerOperandType<T, Db, Scope, Params, Numeric>
						: R
				: PeerOperandType<T, Db, Scope, Params, Numeric>
			: never
		: PeerOperandType<T, Db, Scope, Params, Numeric>
	: never

type ProbeFromPeers<
	Key,
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Key extends string | number
	? [PeerOperandType<Ops, Db, Scope, Params, Numeric>] extends [never]
		? // CORE-7: only parameters without a type meet; another position may still type one of them in a later
			// round (#145), so the error is marked and an AND / OR gives way to a probe found next to it
			AllParamOperands<Ops> extends true
			? ParamUnresolved<Key>
			: never
		: PeerOperandType<Ops, Db, Scope, Params, Numeric> extends infer S extends SqlTypeShape
			? ParamProbeFound<Key, ProbeTypeFromPeer<S>, SamePeerBindings<Ops, Params, Key, ProbeTypeFromPeer<S>>>
			: never
	: never

/** CORE-6: the other parameter operands without a type take the same peer type in the same round. */
type SamePeerBindings<
	Ops extends readonly unknown[],
	Params extends ExpressionParamsShape,
	First,
	S extends SqlTypeShape,
	Acc extends readonly ProbeBinding[] = [],
> = Ops extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? SamePeerBindings<T, Params, First, S, Acc>
			: K extends First
				? SamePeerBindings<T, Params, First, S, Acc>
				: K extends string | number
					? SamePeerBindings<T, Params, First, S, [...Acc, readonly [K, S]]>
					: SamePeerBindings<T, Params, First, S, Acc>
		: never
	: Acc

/** CORE-6 (#143): the later arguments that are parameters without a type take their catalog types in the same round. */
type MoreArgBindings<
	Args extends readonly unknown[],
	Row,
	Params extends ExpressionParamsShape,
	First,
	Index extends number,
	Acc extends readonly ProbeBinding[] = [],
> = Args extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? MoreArgBindings<T, Row, Params, First, Inc<Index>, Acc>
			: K extends First
				? MoreArgBindings<T, Row, Params, First, Inc<Index>, Acc>
				: K extends string | number
					? [RowArgType<Row, Index>] extends [never]
						? MoreArgBindings<T, Row, Params, First, Inc<Index>, Acc>
						: RowArgType<Row, Index> extends infer S extends SqlTypeShape
							? MoreArgBindings<T, Row, Params, First, Inc<Index>, [...Acc, readonly [K, S]]>
							: MoreArgBindings<T, Row, Params, First, Inc<Index>, Acc>
					: MoreArgBindings<T, Row, Params, First, Inc<Index>, Acc>
		: never
	: Acc

/** The first argument that is a parameter without a type, resolved by the function's argument types. */
type ProbeInFunctionArgs<
	Name extends string,
	Args extends readonly unknown[],
	AllArgs extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Index extends number = 0,
> = Args extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? ProbeInFunctionArgs<Name, T, AllArgs, Db, Scope, Params, Inc<Index>>
			: K extends string | number
				? CatalogRow<DialectFact<Db, "functionCatalog">, Name, AllArgs["length"]> extends infer Row
					? IsPeerTypedRow<Row> extends true
						? ProbeFromPeers<K, AllArgs, Db, Scope, Params, false>
						: [RowArgType<Row, Index>] extends [never]
							? never
							: ParamProbeFound<K, RowArgType<Row, Index>, MoreArgBindings<T, Row, Params, K, Inc<Index>>>
					: never
				: never
		: never
	: never

/**
 * CORE-6: a parameter that has no type yet (a probe, src/core/param-probe.ts) gets one from the operator, cast or
 * function it stands in; the result is the error that carries that type to the driver. `never` for everything else.
 */
export type ParamProbeAt<
	Ast,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = [SharedTypeOperands<Ast>] extends [never]
	? Ast extends {
			kind: "pg_cast" | "sql_cast"
			expr: infer E
			type_parts: infer P extends readonly string[]
		}
		? ParamOperandProbeKey<E, Params> extends infer K
			? [K] extends [never]
				? never
				: K extends string | number
					? ResolveCastFromShape<Db, SqlText, SqlCastTypeNorm<P>> extends infer S extends SqlTypeShape
						? ParamProbeFound<K, S>
						: never
					: never
			: never
		: Ast extends {
					kind: "function_call"
					name: infer Fn extends string
					args: infer A extends readonly unknown[]
			  }
			? ProbeInFunctionArgs<Lowercase<Fn>, A, A, Db, Scope, Params>
			: never
	: SharedTypeOperands<Ast> extends { ops: infer Ops extends readonly unknown[]; numeric: infer N extends boolean }
		? ProbeInOperands<Ops, Ops, Db, Scope, Params, N>
		: never

type ProbeInOperands<
	Rest extends readonly unknown[],
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Rest extends readonly [infer H, ...infer T]
	? ParamOperandProbeKey<H, Params> extends infer K
		? [K] extends [never]
			? ProbeInOperands<T, Ops, Db, Scope, Params, Numeric>
			: ProbeFromPeers<K, Ops, Db, Scope, Params, Numeric>
		: never
	: never

/** The operand expressions of an operator whose result is NULL when an operand is NULL (CORE-2). */
type NullPropagatingOperands<Ast> = Ast extends {
	kind: "add" | "sub" | "mul" | "exp" | "mod" | "custom_op" | "cmp" | "and" | "or"
	left: infer L extends ScalarExprAst
	right: infer R extends ScalarExprAst
}
	? readonly [L, R]
	: Ast extends { kind: "neg" | "not"; inner: infer I extends ScalarExprAst }
		? readonly [I]
		: Ast extends { kind: "pg_cast" | "sql_cast"; expr: infer E extends ScalarExprAst }
			? readonly [E]
			: Ast extends {
						kind: "between"
						expr: infer E extends ScalarExprAst
						low: infer Lo extends ScalarExprAst
						high: infer Hi extends ScalarExprAst
				  }
				? readonly [E, Lo, Hi]
				: Ast extends {
							kind: "like" | "pg_regex_match"
							expr: infer E extends ScalarExprAst
							pattern: infer P extends ScalarExprAst
					  }
					? readonly [E, P]
					: Ast extends {
								kind: "in_list"
								expr: infer E extends ScalarExprAst
								items: infer Its extends readonly ScalarExprAst[]
						  }
						? readonly [E, ...Its]
						: Ast extends {
									kind: "any_op" | "all_op" | "some_op"
									left: infer L extends ScalarExprAst
							  }
							? readonly [L]
							: readonly []

type AnyOperandNullable<
	Ops extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Ops extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ResolveExpressionAST<H, Db, Scope, Params> extends { nullable: true }
		? true
		: AnyOperandNullable<T, Db, Scope, Params>
	: false

/** CORE-2: an operator result is nullable when any operand is. */
export type ApplyOperandNullability<
	Ast,
	Res,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Res extends DbtyperErrorShape
	? Res
	: Res extends SqlTypeShape
		? Res["nullable"] extends true
			? Res
			: AnyOperandNullable<NullPropagatingOperands<Ast>, Db, Scope, Params> extends true
				? Nullable<Res>
				: Res
		: Res
