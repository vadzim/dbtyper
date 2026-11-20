import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ScalarExprAst, ScalarIdentParts } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ReadParam } from "./resolve-expression-ident.ts"
import type { ScopeEntry, ScopeMap, VisibleColumnsOf, RowidResultKey } from "./parser-scope.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FirstDuplicateName, UnionToStringTuple } from "./set-operation-types.ts"
import type { JsqlColumnResultKey, JsqlDbGetData } from "../core/jsql-utils.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { ItemAs, RawSelectItem } from "./parse-select.ts"
import type { OutNameFromParts, ScopeEntryOfSingle, SingleAliasScope } from "./parse-select-returning.ts"

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
					returning: StarColumns<Db, E>
					order: StarNames<Db, E>
				}
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
	: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
		? Res extends DbtyperErrorShape
			? Res
			: Res extends JsqlSelectStatementResult
				? SelectItemNames<Items, Scope, Items, [], IsPositionalSelect<Db>, Db> extends infer Names extends
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

/** The table or view a scope entry reads, or `null` (a CTE or a subquery). */
type EntryData<Db, E> = Db extends JsqlDatabaseShape
	? E extends { schema: infer S extends string; table: infer T extends string }
		? JsqlDbGetData<Db, S, T>
		: null
	: null

/** `Names` that are keys of `Keys`, in order. */
type NamesIn<Names extends readonly string[], Keys> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Keys
		? [H, ...NamesIn<R, Keys>]
		: NamesIn<R, Keys>
	: []

/**
 * The columns `*` / `alias.*` give: the visible columns, keyed by their declared spelling where the table has one
 * (SQLite, SQLT-28, #151: the drivers return the declared name).
 */
type StarColumns<Db, E extends ScopeEntry> =
	EntryData<Db, E> extends { spelled: infer Sp }
		? VisibleColumnsOf<E> extends infer V extends Record<string, SqlTypeShape>
			? { [K in keyof V as K extends keyof Sp ? Sp[K] & string : K]: V[K] } extends infer R extends Record<
					string,
					SqlTypeShape
				>
				? R
				: never
			: never
		: VisibleColumnsOf<E>

/**
 * Output column names of `*` in position order (CORE-8 matches set-operation arms by position, CORE-11): the declared
 * order of the table or view (#150); a CTE or subquery has none, its keys are taken in the order TypeScript lists them.
 */
type StarNames<Db, E extends ScopeEntry> =
	EntryData<Db, E> extends infer Data
		? Data extends { order: infer O extends readonly string[] }
			? string[] extends O
				? UnionToStringTuple<keyof StarColumns<Db, E> & string>
				: ResultKeysOf<Data, NamesIn<O, keyof VisibleColumnsOf<E>>>
			: UnionToStringTuple<keyof StarColumns<Db, E> & string>
		: never

type ResultKeysOf<Data, Names extends readonly string[]> = { [I in keyof Names]: JsqlColumnResultKey<Data, Names[I]> }

/**
 * SQLT-28, #151: the result key of a plain column reference where names match case-insensitively (SQLite, fact
 * `foldQuoted`): the declared spelling of the column it reads, else its (lower-case) key. Other dialects: `Key`.
 */
type ColumnRefKey<
	Db,
	Scope extends ScopeMap,
	P extends ScalarIdentParts,
	Key extends string,
> = Db extends JsqlDatabaseShape
	? DialectFact<Db, "lexer">["foldQuoted"] extends true
		? JsqlColumnResultKey<EntryData<Db, ColumnRefEntry<Scope, P, Key>>, Key>
		: Key
	: Key

/** The scope entry a column reference reads (the innermost level first for a bare name). */
type ColumnRefEntry<Scope extends ScopeMap, P extends ScalarIdentParts, Key extends string> = P extends readonly [
	infer Sch extends string,
	infer Tab extends string,
	string,
]
	? ScopeEntryForQualifiedName<Scope, Sch, Tab>
	: P extends readonly [infer T extends string, string]
		? T extends keyof Scope
			? Scope[T]
			: never
		: {
					[K in keyof Scope]: Key extends keyof Scope[K]["columns"]
						? Scope[K] extends { outerDepth: readonly [1, ...1[]] }
							? never
							: Scope[K]
						: never
			  }[keyof Scope] extends infer Inner
			? [Inner] extends [never]
				? { [K in keyof Scope]: Key extends keyof Scope[K]["columns"] ? Scope[K] : never }[keyof Scope]
				: Inner
			: never

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
	Db = null,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "param"; param: infer P extends string; as?: infer As }
		? SelectItemNames<R, Scope, AllItems, [...Acc, As extends string ? As : P], Positional, Db>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ItemAs<H> extends infer As
				? Ast extends {
						kind: "qualified_table_star"
						schema: infer Sch extends string
						table: infer Tab extends string
					}
					? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E extends ScopeEntry
						? StarNames<Db, E> extends infer T extends readonly string[]
							? SelectItemNames<R, Scope, AllItems, [...Acc, ...T], Positional, Db>
							: Acc
						: Acc
					: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
						? Al extends keyof Scope
							? StarNames<Db, Scope[Al]> extends infer T extends readonly string[]
								? SelectItemNames<R, Scope, AllItems, [...Acc, ...T], Positional, Db>
								: Acc
							: Acc
						: OutNameFromExprAst<
									Ast,
									As,
									AllItems,
									Scope,
									PositionalName<Positional, Items>,
									Db
							  > extends infer O extends string
							? SelectItemNames<R, Scope, AllItems, [...Acc, O], Positional, Db>
							: Acc
				: Acc
			: Acc
	: Acc

/**
 * The select-list accumulator is a union of `[name, type]` entries (a bare `*` adds one entry per column), turned into
 * the result record once at the end. Merging a record per item rebuilt the whole record each time, so a long list cost
 * quadratic time (#105, DECISIONS.md); a union only grows by its new member. A duplicate name (an error, CORE-11) would
 * give a union of types, but the duplicate check rejects the list before the record is used.
 */
type SelectEntry = readonly [string, SqlTypeShape]

type RecordEntries<R extends Record<string, SqlTypeShape>> = {
	[K in keyof R & string]: readonly [K, R[K]]
}[keyof R & string]

type EntriesToRecord<E extends SelectEntry> = { [P in E as P[0]]: P[1] }

export type ResolveSelectList<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> = ResolveSelectListAcc<Items, Db, Scope, Params, never, Items>

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
	Db = null,
> = As extends string
	? As
	: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
		? // SQLT-28, #151: a column is keyed by its declared name, as the drivers return it
			RowidResultKey<P, Scope, ColumnRefKey<Db, Scope, P, OutNameFromParts<P, undefined>>>
		: Ast extends { kind: "function_call" | "window_function"; name: infer N extends string }
			? // SEL-8: PostgreSQL names an unaliased function call (aggregate included) by the function name.
				Lowercase<N>
			: Ast extends { kind: "pg_cast" | "sql_cast"; expr: infer Inner extends ScalarExprAst }
				? // EXPR-24: an unaliased cast is named after the cast operand (`id::uuid` -> `id`).
					OutNameFromExprAst<Inner, undefined, AllItems, Scope, Pos, Db>
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
	Sqls extends SelectEntry,
	AllItems extends readonly RawSelectItem[],
> = Ast extends { kind: "qualified_table_star"; schema: infer Sch extends string; table: infer Tab extends string }
	? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E
		? E extends ScopeEntry
			? ResolveSelectListAcc<R, Db, Scope, Params, Sqls | RecordEntries<StarColumns<Db, E>>, AllItems>
			: FormatError<Errors["UNKNOWN_TABLE"], [Sch, "SELECT ... *"]>
		: FormatError<Errors["UNKNOWN_TABLE"], [Tab, "SELECT ... *"]>
	: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
		? Al extends keyof Scope
			? Scope[Al] extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, Sqls | RecordEntries<StarColumns<Db, E>>, AllItems>
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
							PositionalName<IsPositionalSelect<Db>, [unknown, ...R]>,
							Db
						> extends infer O extends string
						? O extends "__invalid_select_expr_alias__"
							? FormatError<Errors["SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS"], []>
							: ResolveSelectListAcc<R, Db, Scope, Params, Sqls | [O, Ev], AllItems>
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
	Sqls extends SelectEntry,
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
					? ResolveSelectListAcc<R, Db, Scope, Params, Sqls | [O, Sql], AllItems>
					: never
				: never
		: never

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends SelectEntry,
	AllItems extends readonly RawSelectItem[] = Items,
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? H extends { kind: "star" }
		? SingleAliasScope<Scope> extends true
			? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
				? ResolveSelectListAcc<R, Db, Scope, Params, Sqls | RecordEntries<StarColumns<Db, E>>, AllItems>
				: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
			? ResolveSelectListExprItem<Ast, ItemAs<H>, R, Db, Scope, Params, Sqls, AllItems>
			: H extends { kind: "param"; param: infer P extends string; as?: infer As }
				? ResolveSelectListParamItem<P, As, R, Db, Scope, Params, Sqls, AllItems>
				: never
	: { kind: "select"; returning: EntriesToRecord<Sqls> }
