import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { ParamProbeFound, ProbeKeyOf, ProbeTypeFromPeer } from "../core/param-probe.ts"
import type { Nullable, SqlText, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Inc } from "../core/type-utils.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
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

type ParamDisplay<K extends string | number> = K extends number ? `$${Inc<K>}` : `:${K & string}`

type AllParamOperands<Ops extends readonly unknown[]> = Ops extends readonly [infer H, ...infer T]
	? IsParamOperand<H> extends true
		? AllParamOperands<T>
		: false
	: true

type IsParamOperand<Op> = Op extends { kind: "param" | "positional-param" } ? true : false

/** The type of the first operand that is not a parameter, resolves to a real type (and a numeric one if asked). */
type PeerOperandType<
	Ops extends readonly unknown[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Numeric extends boolean,
> = Ops extends readonly [infer H, ...infer T]
	? IsParamOperand<H> extends true
		? PeerOperandType<T, Db, Scope, Params, Numeric>
		: H extends ScalarExprAst
			? ResolveExpressionAST<H, Db, Scope, Params> extends infer R
				? R extends SqlTypeShape
					? R["type"] extends "null" | "param-probe"
						? PeerOperandType<T, Db, Scope, Params, Numeric>
						: Numeric extends true
							? R["type"] extends
									| "integer"
									| "bigint"
									| "smallint"
									| "numeric"
									| "real"
									| "double precision"
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
		? // CORE-7: only parameters meet, nothing gives them a type
			AllParamOperands<Ops> extends true
			? FormatError<Errors["CANNOT_INFER_PARAMETER_TYPE"], [ParamDisplay<Key>, ParamDisplay<Key>]>
			: never
		: PeerOperandType<Ops, Db, Scope, Params, Numeric> extends infer S extends SqlTypeShape
			? ParamProbeFound<Key, ProbeTypeFromPeer<S>>
			: never
	: never

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
							: ParamProbeFound<K, RowArgType<Row, Index>>
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
