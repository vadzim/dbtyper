import type { ForceProps, MergeRecords } from "../core/type-utils.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseRawSelectList } from "./parse-select-list.ts"
import type { RawSelectItem, SelectListStarInvalid } from "./parse-select.ts"
import type { ResolveSelectList } from "./parse-select-resolve.ts"

/**
 * The select-list accumulator. Every item merges into the previous record; without forcing, each layer stays a lazy
 * mapped type pointing at the one before, and reading a property after ~50 items exceeds the instantiation depth
 * (TS2589, #105). The properties are resolved right away (inferring from all of them does it), the same shape as
 * ForceProps in src/core/type-utils.ts (#48): required, do not make it lazy.
 */
export type MergeStringRecords<
	A extends Record<string, SqlTypeShape>,
	B extends Record<string, SqlTypeShape>,
> = ForceProps<MergeRecords<A, B>>

export type SingleAliasScope<Scope extends ScopeMap> = [keyof Scope] extends [never]
	? false
	: [{ [K in keyof Scope]: Exclude<keyof Scope, K> }[keyof Scope]] extends [never]
		? true
		: false

export type ScopeEntryOfSingle<Scope extends ScopeMap> = keyof Scope extends infer K
	? K extends keyof Scope
		? Scope[K]
		: never
	: never

export type OutNameFromParts<
	P extends readonly [string] | readonly [string, string] | readonly [string, string, string],
	As,
> = As extends string
	? As
	: P extends readonly [string, string, infer C extends string]
		? C
		: P extends readonly [infer _A extends string, infer C2 extends string]
			? C2
			: P extends readonly [infer C0 extends string]
				? C0
				: "__bad_out_name_parts__"

/** Parse and resolve a `RETURNING` projection list against a caller-supplied `ScopeMap` (e.g. `INSERT` row). */
export type ParseAndResolveReturningClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseRawSelectList<Tokens, Db, Params, {}> extends [infer After extends ParserMonad, infer Items]
		? Items extends DbtyperErrorShape
			? [After, Db, Items]
			: Items extends readonly RawSelectItem[]
				? SelectListStarInvalid<Items> extends true
					? [After, Db, FormatError<Errors["SELECT_STAR_MUST_BE_THE_ONLY_PROJECTION_IN_THE_LIST"], []>]
					: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
						? Res extends DbtyperErrorShape
							? [After, Db, WithErrorClause<Res, "RETURNING">]
							: Res extends JsqlSelectStatementResult
								? [After, Db, Res]
								: never
						: never
				: never
		: never
