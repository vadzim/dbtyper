import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ScalarExprAst, ScalarIdentParts } from "./parse-expression.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { RawSelectItem } from "./parse-select.ts"
import type { SelectGroupClauseMeta } from "./parse-select-group-by.ts"
import type { SelectItemsNeedGroupedProjRules } from "./parse-select-grouped-aggregate.ts"
import type { ExprValidInsideGroupedSelection } from "./parse-select-grouped-valid.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { JsqlDbGetTable, JsqlTablePrimaryKey } from "../core/jsql-utils.ts"

type AstColPartsMatchGroupKey<KeyAst extends ScalarExprAst, Parts extends ScalarIdentParts> = KeyAst extends {
	kind: "col"
	parts: infer Q extends ScalarIdentParts
}
	? [Q] extends [Parts]
		? true
		: [Parts] extends [Q]
			? true
			: false
	: false

export type GroupKeySetContainsColParts<
	Parts extends ScalarIdentParts,
	Keys extends readonly ScalarExprAst[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer Rest extends readonly ScalarExprAst[]]
	? AstColPartsMatchGroupKey<K, Parts> extends true
		? true
		: GroupKeySetContainsColParts<Parts, Rest>
	: false

/** SEL-28: output-column position of an expression select item (`1` is the first item), `never` otherwise. */
type SelectItemAstAtPosition<
	Items extends readonly RawSelectItem[],
	Pos extends string,
	Counter extends readonly 1[] = readonly [1],
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? `${Counter["length"]}` extends Pos
		? H extends { kind: "expr"; ast: infer A extends ScalarExprAst }
			? A
			: never
		: SelectItemAstAtPosition<R, Pos, readonly [...Counter, 1]>
	: never

/** SEL-28: replace an integer-literal GROUP BY key by the select item at that position. */
type GroupKeysWithPositionsResolved<
	Keys extends readonly ScalarExprAst[],
	Items extends readonly RawSelectItem[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? [
			K extends { kind: "number"; raw: infer Raw extends string }
				? SelectItemAstAtPosition<Items, Raw> extends infer A
					? [A] extends [never]
						? K
						: A
					: K
				: K,
			...GroupKeysWithPositionsResolved<R, Items>,
		]
	: readonly []

export type AstEqualsGroupKey<
	Ast extends ScalarExprAst,
	Keys extends readonly ScalarExprAst[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? [Ast] extends [K]
		? [K] extends [Ast]
			? true
			: AstEqualsGroupKey<Ast, R>
		: AstEqualsGroupKey<Ast, R>
	: false

type ValidateGroupedSelectItemsAgainstKeys<
	Db,
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
> = Items extends readonly [infer H extends RawSelectItem, ...infer Rest extends readonly RawSelectItem[]]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? ExprValidInsideGroupedSelection<Db, Ast, GroupKeys, false> extends true
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: never
	: true

export type GroupedProjValidationOutcome<
	Db,
	Items extends readonly RawSelectItem[],
	Meta extends SelectGroupClauseMeta,
	Scope extends ScopeMap,
> =
	DialectFact<Db, "groupByRule"> extends false
		? true // SQLT-28: SQLite allows bare columns next to an aggregate
		: SelectItemsNeedGroupedProjRules<Db, Meta, Items> extends true
			? GroupKeysWithPositionsResolved<Meta["group_key_asts"], Items> extends infer Keys extends
					readonly ScalarExprAst[]
				? ValidateGroupedSelectItemsAgainstKeys<Db, Items, WithPkGroupedColumns<Db, Scope, Keys>>
				: never
			: true

/**
 * SEL-27 (PostgreSQL): when every column of a FROM table's PRIMARY KEY is a GROUP BY key, each column of that table
 * is grouped too (it depends on the key). `Keys` gets one more key whose parts are every such column, qualified by
 * the alias and bare; a scope without such a table adds nothing.
 */
type WithPkGroupedColumns<Db, Scope extends ScopeMap, Keys extends readonly ScalarExprAst[]> =
	PkGroupedAliases<Db, Scope, Keys> extends infer A extends keyof Scope & string
		? [A] extends [never]
			? Keys
			: [
					...Keys,
					{
						kind: "col"
						parts: A extends unknown
							? | readonly [A, keyof Scope[A]["columns"] & string]
								| readonly [keyof Scope[A]["columns"] & string]
							: never
					},
				]
		: Keys

/** The aliases of `Scope` whose table has a PRIMARY KEY made only of GROUP BY keys (`never` when none). */
type PkGroupedAliases<Db, Scope extends ScopeMap, Keys extends readonly ScalarExprAst[]> = {
	[A in keyof Scope & string]: Db extends JsqlDatabaseShape
		? JsqlTablePrimaryKey<JsqlDbGetTable<Db, Scope[A]["schema"], Scope[A]["table"]>> extends {
				columns: infer C extends string
			}
			? [Exclude<C, KeyColumnsOf<A, Scope[A]["columns"], Keys[number]>>] extends [never]
				? A
				: never
			: never
		: never
}[keyof Scope & string]

/** The columns of alias `A` that are GROUP BY keys: `A.c`, or a bare `c` of a column `A` has. */
type KeyColumnsOf<A extends string, Cols, K> = K extends { kind: "col"; parts: infer P }
	? P extends readonly [A, infer C extends string]
		? C
		: P extends readonly [infer C extends string]
			? C & keyof Cols
			: never
	: never
