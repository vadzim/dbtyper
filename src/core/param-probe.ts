/**
 * Parameter types come out of the parser (CORE-6, CORE-7).
 *
 * The parser is run with every given parameter bound to a probe (`SqlParamProbe`). The first place that gives a probe
 * a type (an operand of a comparison, a column of INSERT / UPDATE SET, a function argument, CAST, LIMIT) returns
 * `ParamProbeFound` instead of its result; an error propagates up through the parser like any other. Where the
 * parser has several independent parts at hand (both sides of AND / OR, the cells of a VALUES row, the assignments
 * of SET, parameter operands with one peer) the found probes are collected into one `ParamProbeFound` (`more`), so
 * one round binds them all (#143). The driver below binds those types and runs again, until no probe is found. A
 * probe that is left unbound has no type from its position: CORE-7.
 */
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { ParserSyntax } from "./dialect.ts"
import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { SqlTypeShape, NonNull } from "./sql-type-shape.ts"
import type { Inc, LastOf } from "./type-utils.ts"

/** The type of a parameter that no position has given a type yet; `arg` is its key (name, or 0-based index). */
type SqlParamProbe<Key extends string | number> = { type: "param-probe"; arg: Key; nullable: false }

/** A parameter marked for the usage probe: reading it is an error (PARAM-14, see `LookupParam`). */
type SqlParamReadProbe = { type: "param-read-probe"; arg: null; nullable: false }

/** The type of a parameter the SQL does not use: any value is accepted (PARAM-14). */
type SqlParamUnused = { type: "param-unused"; arg: null; nullable: false }

/** The probe key of a resolved parameter type, `never` for a real type. */
export type ProbeKeyOf<S> = S extends { type: "param-probe"; arg: infer K extends string | number } ? K : never

type DisplayKey<K extends string | number> = K extends number ? `$${Inc<K>}` : `:${K & string}`

/** Error carrying the type a position gives to the probe `Key`; shows as CORE-7 if it ever reaches the user. */
export type ParamProbeFound<
	Key extends string | number,
	S extends SqlTypeShape,
	More extends readonly ProbeBinding[] = [],
> = FormatError<Errors["CANNOT_INFER_PARAMETER_TYPE"], [DisplayKey<Key>, DisplayKey<Key>]> & {
	__param_probe__: { key: Key; type: S; more: More }
}

/** One probe key with the type a position gives it. */
export type ProbeBinding = readonly [string | number, SqlTypeShape]

/** Every binding a `ParamProbeFound` carries, in the order they were found; `[]` for anything else. */
type ProbeBindingsOf<E> = E extends {
	__param_probe__: { key: infer K extends string | number; type: infer S extends SqlTypeShape; more: infer M }
}
	? M extends readonly ProbeBinding[]
		? [readonly [K, S], ...M]
		: [readonly [K, S]]
	: []

export type IsParamProbeFound<E> = E extends { __param_probe__: unknown } ? true : false

/**
 * Two results of one round, `Found` being an error (the earlier position): when both are found probes, `Found`
 * collects the probes of `Next`, so one round binds them all (instead of one parse per parameter). Otherwise
 * `Found` is the result, as in the one-at-a-time loop: an earlier error is never replaced by a later probe or value
 * (that would drop a CORE-7 or a PARAM-14 read mark of the earlier position).
 */
export type CollectParamProbes<Found, Next> = Found extends {
	__param_probe__: { key: infer K extends string | number; type: infer S extends SqlTypeShape; more: infer M }
}
	? IsParamProbeFound<Next> extends true
		? M extends readonly ProbeBinding[]
			? ParamProbeFound<K, S, [...M, ...ProbeBindingsOf<Next>]>
			: Found
		: Found
	: Found

/** The type a comparison-like position gives to a probe: never null (a nullable column is compared, not assigned). */
export type ProbeTypeFromPeer<S extends SqlTypeShape> = NonNull<S>

type InitialProbes<V> = V extends readonly unknown[]
	? number extends V["length"]
		? EmptyExpressionParams
		: { [I in keyof V]: SqlParamProbe<I extends `${infer N extends number}` ? N : never> }
	: { [K in Extract<keyof V, string>]: SqlParamProbe<K> }

/** The bindings as a map by key; the first binding of a key wins. */
type ProbeMap<B extends readonly unknown[], Acc = {}> = B extends readonly [
	readonly [infer K extends string | number, infer S],
	...infer T,
]
	? `${K}` extends keyof Acc
		? ProbeMap<T, Acc>
		: ProbeMap<T, Acc & { [P in `${K}`]: S }>
	: Acc

type BindProbes<Params, B extends readonly unknown[]> =
	ProbeMap<B> extends infer M
		? Params extends readonly unknown[]
			? { [I in keyof Params]: I extends keyof M ? M[I] : Params[I] }
			: { [K in keyof Params]: K extends keyof M ? M[K] : Params[K] }
		: never

type BindProbe<Params, Key extends string | number, S extends SqlTypeShape> = BindProbes<Params, [readonly [Key, S]]>

type LeftoverProbe<Params> = Params extends readonly unknown[]
	? Params extends readonly [infer H, ...infer T]
		? [ProbeKeyOf<H>] extends [never]
			? LeftoverProbe<T>
			: ProbeKeyOf<H>
		: never
	: LastOf<ProbeKeyOf<Params[keyof Params]>>

/**
 * The retry loop (DECISIONS.md, "Parameter types from the expression parser"). Each round runs the whole
 * `ApplyStatements` again and types every parameter the round found (#143: AND / OR chains, VALUES rows, SET lists
 * and IN lists come out in one round), so a WHERE / INSERT / UPDATE with N parameters is parsed a few times, not
 * N+1 times. The loop stops by itself (every round binds a probe or ends), the limit is the instantiation budget;
 * test/stress has statements with 30, 100 and 150 parameters.
 */
type Derive<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Syntax extends ParserSyntax,
	Params extends ExpressionParamsShape,
> =
	ApplyStatements<Db, Stmt, Params, Syntax> extends [unknown, infer Err, ...unknown[]]
		? IsParamProbeFound<Err> extends true
			? BindProbes<Params, ProbeBindingsOf<Err>> extends infer Next extends ExpressionParamsShape
				? Derive<Db, Stmt, Syntax, Next>
				: never
			: Err extends DbtyperErrorShape
				? Err
				: LeftoverProbe<Params> extends infer P extends string | number
					? [P] extends [never]
						? Params
						: // PARAM-14: a parameter the SQL never reads is accepted; one that is read and typed by no position is CORE-7
							ApplyStatements<Db, Stmt, BindProbe<Params, P, SqlParamReadProbe>, Syntax> extends [
									unknown,
									FormatError<Errors["PARAMETER_PROBE_READ"], []>,
									...unknown[],
							  ]
							? FormatError<Errors["CANNOT_INFER_PARAMETER_TYPE"], [DisplayKey<P>, DisplayKey<P>]>
							: BindProbe<Params, P, SqlParamUnused> extends infer Next extends ExpressionParamsShape
								? Derive<Db, Stmt, Syntax, Next>
								: never
					: never
		: never

/**
 * The parameter types of `Stmt` for the given values (CORE-6): a record by name or a tuple by position, the
 * parser's own error, or the CORE-7 error for a parameter whose type no position gives.
 */
export type DeriveQueryParams<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Syntax extends ParserSyntax,
	Values,
> = Values extends null | undefined
	? EmptyExpressionParams
	: InitialProbes<Values> extends infer P extends ExpressionParamsShape
		? Derive<Db, Stmt, Syntax, P>
		: never
