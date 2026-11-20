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

/** The column parts of the `col` keys, as a union (built once per key list: the alias is cached by its arguments). */
type GroupKeyColParts<Keys extends readonly ScalarExprAst[]> = Keys[number] extends infer K
	? K extends { kind: "col"; parts: infer Q extends ScalarIdentParts }
		? Q
		: never
	: never

/**
 * Is the column `Parts` one of the `col` keys. A membership test in a union, not a walk over the keys per select item
 * (quadratic, #208); the walk matched in either direction, which only differs for a key made of several column parts
 * (SEL-27), and there the key is the union and the column is one of its members.
 */
export type GroupKeySetContainsColParts<Parts extends ScalarIdentParts, Keys extends readonly ScalarExprAst[]> = [
	Parts,
] extends [GroupKeyColParts<Keys>]
	? true
	: false

/** SEL-28: the expression of an item, `never` for a `*` or a parameter. */
type ItemExprAst<Item> = Item extends { kind: "expr"; ast: infer A extends ScalarExprAst } ? A : never

/**
 * SEL-28: output-column position of an expression select item (`1` is the first item), `never` otherwise. Walks the
 * items by index (splitting the tuple per step is quadratic, #208).
 */
type SelectItemAstAtPosition<
	Items extends readonly RawSelectItem[],
	Pos extends string,
	Before extends readonly 1[] = [],
> = Before["length"] extends Items["length"]
	? never
	: [...Before, 1]["length"] extends infer Counter extends number
		? `${Counter}` extends Pos
			? ItemExprAst<Items[Before["length"]]>
			: SelectItemAstAtPosition<Items, Pos, [...Before, 1]>
		: never

/** SEL-28: an integer-literal GROUP BY key stands for the select item at that position; any other key stays. */
type GroupKeyWithPositionResolved<K extends ScalarExprAst, Items extends readonly RawSelectItem[]> = K extends {
	kind: "number"
	raw: infer Raw extends string
}
	? SelectItemAstAtPosition<Items, Raw> extends infer A extends ScalarExprAst
		? [A] extends [never]
			? K
			: A
		: K
	: K

/** SEL-28: replace every integer-literal GROUP BY key by the select item at that position (index walk, #208). */
type GroupKeysWithPositionsResolved<
	Keys extends readonly ScalarExprAst[],
	Items extends readonly RawSelectItem[],
	Before extends readonly 1[] = [],
	Acc extends readonly ScalarExprAst[] = [],
> = Before["length"] extends Keys["length"]
	? Acc
	: GroupKeysWithPositionsResolved<
			Keys,
			Items,
			[...Before, 1],
			[...Acc, GroupKeyWithPositionResolved<Keys[Before["length"]] & {}, Items>]
		>

/**
 * Is `Ast` one of the keys: a membership test in the union of the keys, not a walk over them per select item
 * (quadratic, #208). The keys are parsed trees, so a tree assignable to a key is that key; only the SEL-27 key (its
 * column parts a union) is wider, and a column of it is valid either way (`GroupKeySetContainsColParts`).
 */
export type AstEqualsGroupKey<Ast extends ScalarExprAst, Keys extends readonly ScalarExprAst[]> = [Ast] extends [
	Keys[number],
]
	? true
	: false

/** `true` when the item is allowed next to the group keys, the error otherwise. */
type GroupedSelectItemOutcome<Db, Item, GroupKeys extends readonly ScalarExprAst[]> = Item extends {
	kind: "expr"
	ast: infer Ast extends ScalarExprAst
}
	? ExprValidInsideGroupedSelection<Db, Ast, GroupKeys, false> extends true
		? true
		: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
	: Item extends { kind: "star" } | { kind: "param" }
		? true
		: never

/** Walks the items by index and hands each to a helper (splitting the tuple per step is quadratic, #208). */
type ValidateGroupedSelectItemsAgainstKeys<
	Db,
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
	Before extends readonly 1[] = [],
> = Before["length"] extends Items["length"]
	? true
	: GroupedSelectItemOutcome<Db, Items[Before["length"]], GroupKeys> extends infer R
		? [R] extends [never]
			? never
			: R extends true
				? ValidateGroupedSelectItemsAgainstKeys<Db, Items, GroupKeys, [...Before, 1]>
				: R
		: never

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
