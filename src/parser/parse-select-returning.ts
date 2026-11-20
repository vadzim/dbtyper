import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { CteDefsOnly, FromItemsOnly, ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { ParseRawSelectList } from "./parse-select-list.ts"
import type { RawSelectItem } from "./parse-select.ts"
import type { ResolveSelectList, SelectItemNames } from "./parse-select-resolve.ts"
import type { FirstDuplicateName } from "./set-operation-types.ts"

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
	// DML-21: subqueries of RETURNING see the CTEs of a `WITH … INSERT | UPDATE | DELETE`; `*` is the FROM items only
	ParseRawSelectList<Tokens, Db, Params, CteDefsOnly<Scope>> extends [infer After extends ParserMonad, infer Items]
		? Items extends DbtyperErrorShape
			? [After, Db, Items]
			: Items extends readonly RawSelectItem[]
				? // `*` may sit beside other items here (`returning *, id as id2`), unlike in SELECT
					ResolveSelectList<Items, Db, FromItemsOnly<Scope>, Params> extends infer Res
					? Res extends DbtyperErrorShape
						? [After, Db, WithErrorClause<Res, "RETURNING">]
						: Res extends JsqlSelectStatementResult
							? // CORE-11: the output names of RETURNING are unique too
								SelectItemNames<Items, FromItemsOnly<Scope>> extends infer Names extends
									readonly string[]
								? FirstDuplicateName<Names> extends infer Dup
									? [Dup] extends [never]
										? [After, Db, Res]
										: [
												After,
												Db,
												FormatError<Errors["DUPLICATE_OUTPUT_COLUMN"], [`\`${Dup & string}\``]>,
											]
									: never
								: never
							: never
					: never
				: never
		: never
