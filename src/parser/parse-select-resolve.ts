import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ScalarExprAst, ScalarIdentParts } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ReadParam } from "./resolve-expression-ident.ts"
import type { ScopeEntry, ScopeMap, VisibleColumnsOf, RowidResultKey } from "./parser-scope.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FirstDuplicateName, UnionToStringTuple } from "./set-operation-types.ts"
import type { ItemAs, RawSelectItem } from "./parse-select.ts"
import type {
	MergeStringRecords,
	OutNameFromParts,
	ScopeEntryOfSingle,
	SingleAliasScope,
} from "./parse-select-returning.ts"

/**
 * SEL-6: a bare `*` is resolved against the FROM items of this query level only (never the outer
 * scope of a subquery) and must see exactly one of them.
 */
export type ResolveSelectListFrom<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	FromScope extends ScopeMap,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = Items extends readonly [{ kind: "star" }]
	? SingleAliasScope<FromScope> extends true
		? ScopeEntryOfSingle<FromScope> extends infer E extends ScopeEntry
			? {
					kind: "select"
					returning: VisibleColumnsOf<E>
					order: UnionToStringTuple<keyof VisibleColumnsOf<E> & string>
				}
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
	: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
		? Res extends DbtyperErrorShape
			? Res
			: Res extends JsqlSelectStatementResult
				? SelectItemNames<Items, Scope, Items, [], IsPositionalSelect<Db>> extends infer Names extends
						readonly string[]
					? IsPositionalSelect<Db> extends true
						? Res & { order: Names } // #166: matched by position, a repeated name is fine
						: FirstDuplicateName<Names> extends infer Dup
							? [Dup] extends [never]
								? Res & { order: Names }
								: FormatError<Errors["DUPLICATE_OUTPUT_COLUMN"], [`\`${Dup & string}\``]>
							: never
					: never
				: never
		: never

/** Output column names of a select list in position order (CORE-8 matches set-operation arms by position, CORE-11). */
type StarNames<E extends ScopeEntry> = UnionToStringTuple<keyof VisibleColumnsOf<E> & string>

/** `INSERT … SELECT` (#166): the SELECT list needs no output names. */
type IsPositionalSelect<Db> = Db extends { positionalSelect: true } ? true : false

/** The synthetic output name of an unnamed expression of a positional SELECT: unique by the number of items left. */
type PositionalName<Positional extends boolean, Items extends readonly unknown[]> = Positional extends true
	? `__col${Items["length"]}`
	: never

export type SelectItemNames<
	Items extends readonly RawSelectItem[],
	Scope extends ScopeMap,
	AllItems extends readonly RawSelectItem[] = Items,
	Acc extends readonly string[] = [],
	Positional extends boolean = false,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "param"; param: infer P extends string; as?: infer As }
		? SelectItemNames<R, Scope, AllItems, [...Acc, As extends string ? As : P], Positional>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ItemAs<H> extends infer As
				? Ast extends {
						kind: "qualified_table_star"
						schema: infer Sch extends string
						table: infer Tab extends string
					}
					? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E extends ScopeEntry
						? StarNames<E> extends infer T extends readonly string[]
							? SelectItemNames<R, Scope, AllItems, [...Acc, ...T], Positional>
							: Acc
						: Acc
					: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
						? Al extends keyof Scope
							? StarNames<Scope[Al]> extends infer T extends readonly string[]
								? SelectItemNames<R, Scope, AllItems, [...Acc, ...T], Positional>
								: Acc
							: Acc
						: OutNameFromExprAst<
									Ast,
									As,
									AllItems,
									Scope,
									PositionalName<Positional, Items>
							  > extends infer O extends string
							? SelectItemNames<R, Scope, AllItems, [...Acc, O], Positional>
							: Acc
				: Acc
			: Acc
	: Acc

export type ResolveSelectList<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = ResolveSelectListAcc<Items, Db, Scope, Params, {}, Items>

type LookupSelectParam<Params extends ExpressionParamsShape, Name extends string> = Name extends keyof Params
	? ReadParam<Params[Name]> extends infer S
		? S extends DbtyperErrorShape
			? S // PARAM-14: the usage probe
			: S extends SqlTypeShape
				? { sql: S }
				: never
		: never
	: FormatError<Errors["UNKNOWN_QUERY_PARAMETER"], [Name]>

/** Bound parameter `:name` in the SELECT list — types come from `Params`. */
type ParamSelectOut<As, P extends string, Sql extends SqlTypeShape> = As extends string
	? { out: As; sql: Sql }
	: { out: P; sql: Sql }

type OutNameFromExprAst<
	Ast extends ScalarExprAst,
	As,
	AllItems extends readonly RawSelectItem[],
	Scope extends ScopeMap,
	Pos extends string = never,
> = As extends string
	? As
	: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts; written: infer W extends string }
		? // SQLT-28: a SQLite result key is the column name as written in the query
			W extends ""
			? RowidResultKey<P, Scope, OutNameFromParts<P, undefined>>
			: RowidResultKey<P, Scope, W>
		: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
			? RowidResultKey<P, Scope, OutNameFromParts<P, undefined>>
			: Ast extends { kind: "function_call" | "window_function"; name: infer N extends string }
				? // SEL-8: PostgreSQL names an unaliased function call (aggregate included) by the function name.
					Lowercase<N>
				: Ast extends { kind: "pg_cast" | "sql_cast"; expr: infer Inner extends ScalarExprAst }
					? // EXPR-24: an unaliased cast is named after the cast operand (`id::uuid` -> `id`).
						OutNameFromExprAst<Inner, undefined, AllItems, Scope, Pos>
					: AllItems extends readonly [RawSelectItem]
						? "?column?"
						: [Pos] extends [never]
							? "__invalid_select_expr_alias__"
							: Pos

/** First scope entry whose bound table matches `schema.table`. */
type ScopeEntryForQualifiedName<Scope extends ScopeMap, Sch extends string, Tab extends string> = {
	[K in keyof Scope]: Scope[K]["schema"] extends Sch ? (Scope[K]["table"] extends Tab ? Scope[K] : never) : never
}[keyof Scope]

type ResolveSelectListExprItem<
	Ast extends ScalarExprAst,
	As,
	R extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> = Ast extends { kind: "qualified_table_star"; schema: infer Sch extends string; table: infer Tab extends string }
	? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E
		? E extends ScopeEntry
			? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
			: FormatError<Errors["UNKNOWN_TABLE"], [Sch, "SELECT ... *"]>
		: FormatError<Errors["UNKNOWN_TABLE"], [Tab, "SELECT ... *"]>
	: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
		? Al extends keyof Scope
			? Scope[Al] extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
				: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
			: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
		: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Ev
			? Ev extends DbtyperErrorShape
				? Ev
				: Ev extends SqlTypeShape
					? OutNameFromExprAst<
							Ast,
							As,
							AllItems,
							Scope,
							PositionalName<IsPositionalSelect<Db>, [unknown, ...R]>
						> extends infer O extends string
						? O extends "__invalid_select_expr_alias__"
							? FormatError<Errors["SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS"], []>
							: ResolveSelectListAcc<
									R,
									Db,
									Scope,
									Params,
									MergeStringRecords<Sqls, Record<O, Ev>>,
									AllItems
								>
						: never
					: never
			: never

type ResolveSelectListParamItem<
	P extends string,
	As,
	R extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[],
> =
	LookupSelectParam<Params, P> extends infer PV
		? PV extends DbtyperErrorShape
			? PV
			: PV extends { sql: infer SqlP extends SqlTypeShape }
				? ParamSelectOut<As, P, SqlP> extends {
						out: infer O extends string
						sql: infer Sql extends SqlTypeShape
					}
					? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, Record<O, Sql>>, AllItems>
					: never
				: never
		: never

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends Record<string, SqlTypeShape>,
	AllItems extends readonly RawSelectItem[] = Items,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "star" }
		? SingleAliasScope<Scope> extends true
			? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, MergeStringRecords<Sqls, VisibleColumnsOf<E>>, AllItems>
				: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ResolveSelectListExprItem<Ast, ItemAs<H>, R, Db, Scope, Params, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Sqls, AllItems>
				: never
	: { kind: "select"; returning: Sqls }
