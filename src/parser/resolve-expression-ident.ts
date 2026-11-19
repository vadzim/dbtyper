import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveColumnRefValue } from "./resolve-column-ref.ts"

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
export type WrittenOf<T> = T extends { written: infer W extends string } ? W : ""

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
