import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"

/** PARAM-14: reading a parameter the usage probe (src/core/param-probe.ts) has marked is an error that says "used". */
export type ReadParam<S> = S extends { type: "param-read-probe" } ? FormatError<Errors["PARAMETER_PROBE_READ"], []> : S

export type LookupParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? ReadParam<Params[Name]>
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

export type LookupPositionalParam<
	Params extends ExpressionParamsShape,
	Index extends number,
> = Params extends readonly SqlTypeShape[]
	? // PARAM-13: for a tuple (`["a"]`) an index beyond its length is out of bounds; a plain array has no known length
		number extends Params["length"]
		? Params[number]
		: `${Index}` extends keyof Params
			? ReadParam<Params[Index]>
			: FormatError<Errors["POSITIONAL_PARAMETER_OUT_OF_BOUNDS"], [Index]>
	: FormatError<Errors["POSITIONAL_PARAMETER_REQUIRES_ARRAY"], []>

export type ResolveIdentChainValue<
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
