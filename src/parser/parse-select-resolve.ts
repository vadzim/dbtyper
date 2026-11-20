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
			? WithViewUserTypes<
					{
						kind: "select"
						returning: StarColumns<KeyDb<Db>, E>
						order: StarNames<Db, E>
					},
					Items,
					Db,
					FromScope,
					FromScope
				>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
	: ResolveSelectList<Items, Db, Scope, Params> extends infer Res
		? Res extends DbtyperErrorShape
			? Res
			: Res extends JsqlSelectStatementResult
				? SelectItemNames<
						Items,
						Scope,
						IsSingleItem<Items>,
						[],
						IsPositionalSelect<Db>,
						NamesDb<Db, Items>
					> extends infer Names extends readonly string[]
					? IsPositionalSelect<Db> extends true
						? Res & { order: Names } // #166: matched by position, a repeated name is fine
						: FirstDuplicateName<Names> extends infer Dup
							? [Dup] extends [never]
								? WithViewUserTypes<Res & { order: Names }, Items, Db, FromScope, Scope>
								: FormatError<Errors["DUPLICATE_OUTPUT_COLUMN"], [`\`${Dup & string}\``]>
							: never
					: never
				: never
		: never

/**
 * #207 (item 1): in the SELECT of a CREATE VIEW (`pendingView`), the domain and composite types (`schema.name`) the
 * select list reads: a column of one (the table's `user_types`), any column of a view that has one, `*` and `alias.*`
 * over them, a subquery's. The view keeps them as its `user_types` (keyed by the type itself), so DROP DOMAIN | TYPE
 * … CASCADE drops it as PostgreSQL does. Other queries never compute this.
 */
type WithViewUserTypes<
	Res,
	Items extends readonly RawSelectItem[],
	Db,
	FromScope extends ScopeMap,
	Scope extends ScopeMap,
> = Db extends { pendingView: true }
	? ItemUserTypes<Items[number], Db, FromScope, Scope> extends infer U extends string
		? [U] extends [never]
			? Res
			: Res & { user_types: { [K in U]: K } }
		: Res
	: Res

/**
 * #210: the user types an expression of another clause (WHERE, HAVING, GROUP BY, JOIN ON) reads, in the SELECT of a
 * CREATE VIEW only: `null` (no `pendingView`, or none read) or `{ viewTypes }`. It travels in the slot where the clause
 * parser put its `null` (no error), and {@link AddViewReads} adds it to the select's `user_types`.
 */
export type ViewReads<Db, Ast, Scope extends ScopeMap> = Db extends { pendingView: true }
	? [AstUserTypes<Ast, Db, Scope>] extends [never]
		? null
		: { viewTypes: AstUserTypes<Ast, Db, Scope> }
	: null

/** `Res` with the user types a clause read (`ViewReads`) added to its `user_types`. */
export type AddViewReads<Res, W> = W extends { viewTypes: infer U extends string }
	? Res & { user_types: { [K in U]: K } }
	: Res

/** The reads of the JOIN … ON conditions, kept by {@link WithJoinReads} as a hidden scope entry. */
type JoinReadsKey = "__view_reads__"

/** `Scope` with the user types `W` (`ViewReads`) read by a JOIN … ON condition added to its hidden entry. */
export type WithJoinReads<Scope extends ScopeMap, W> = W extends { viewTypes: infer U extends string }
	? {
			[K in keyof Scope | JoinReadsKey]: K extends JoinReadsKey
				? {
						schema: "__cte__"
						table: "__subquery__"
						columns: {}
						user_types: { [T in U | AllUserTypes<Scope[JoinReadsKey & keyof Scope]>]: T }
					}
				: Scope[K & keyof Scope]
		}
	: Scope

/** `Res` with the user types the JOIN … ON conditions of `Scope` read. */
export type AddJoinReads<Res, Db, Scope extends ScopeMap> = Db extends { pendingView: true }
	? JoinReadsKey extends keyof Scope
		? AddViewReads<Res, { viewTypes: AllUserTypes<Scope[JoinReadsKey]> }>
		: Res
	: Res

/** The user types an item reads (distributes over a union of items). */
type ItemUserTypes<H, Db, FromScope extends ScopeMap, Scope extends ScopeMap> = H extends { kind: "star" }
	? ScopeEntryOfSingle<FromScope> extends infer E extends ScopeEntry
		? AllUserTypes<EntryData<Db, E>>
		: never
	: H extends { kind: "expr"; ast: infer Ast }
		? Ast extends {
				kind: "qualified_table_star"
				schema: infer Sch extends string
				table: infer Tab extends string
			}
			? AllUserTypes<EntryData<Db, ScopeEntryForQualifiedName<Scope, Sch, Tab>>>
			: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
				? Al extends keyof Scope
					? AllUserTypes<EntryData<Db, Scope[Al]>>
					: never
				: AstUserTypes<Ast, Db, Scope>
		: never

/** Every user type of a relation (a table's columns, a view's or a subquery's types). */
type AllUserTypes<Data> = Data extends { user_types: infer U } ? U[keyof U] & string : never

/** The user types an expression reads: its column references, and the subqueries in it (their own `user_types`). */
type AstUserTypes<A, Db, Scope extends ScopeMap> = A extends { kind: "col"; parts: infer P extends ScalarIdentParts }
	? ColumnUserType<EntryData<Db, ColumnRefEntry<Scope, P, LastPart<P>>>, LastPart<P>>
	: A extends { kind: "select" }
		? AllUserTypes<A>
		: A extends readonly (infer E)[]
			? AstUserTypes<E, Db, Scope>
			: A extends object
				? { [K in keyof A]: K extends "kind" ? never : AstUserTypes<A[K], Db, Scope> }[keyof A]
				: never

type LastPart<P extends ScalarIdentParts> = P extends readonly [...unknown[], infer L extends string] ? L : never

/** The user type of column `Col` of a table, or every one of a view, CTE or subquery (it may read it anywhere). */
type ColumnUserType<Data, Col extends string> = Data extends { kind: "view" } | { schema: "__subquery__" | "__cte__" }
	? AllUserTypes<Data>
	: Data extends { user_types: infer U }
		? Col extends keyof U
			? U[Col] & string
			: never
		: never

/**
 * The database the result keys are looked up in: only where names match case-insensitively (SQLite, fact `foldQuoted`)
 * can a key differ from the name in the scope, so elsewhere it is `null` and the name helpers below stay shared between
 * statements (they are keyed by their type arguments). `*` order (#150) is the exception: it reads the database always.
 */
type KeyDb<Db extends JsqlDatabaseShape> = DialectFact<Db, "lexer">["foldQuoted"] extends true ? Db : null

/** {@link KeyDb}, or the database when the list has an `alias.*`, whose names come in the table's order (#150). */
type NamesDb<Db extends JsqlDatabaseShape, Items extends readonly RawSelectItem[]> = [
	Extract<Items[number], { kind: "expr"; ast: { kind: "qualified_table_star" | "alias_table_star" } }>,
] extends [never]
	? KeyDb<Db>
	: Db

/**
 * What a scope entry reads: the table or view, or for a CTE or subquery the entry itself, which carries its output
 * order and SQLite spellings (`OutputRelation`). `null` for a table when `Db` is `null` ({@link KeyDb}).
 */
type EntryData<Db, E> = E extends { schema: "__subquery__" | "__cte__" }
	? E
	: Db extends JsqlDatabaseShape
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
 * order of the table or view (#150), or the output order of a CTE or subquery (DML-20); without one (a FROM function),
 * the keys are taken in the order TypeScript lists them.
 */
type StarNames<Db, E extends ScopeEntry> =
	EntryData<Db, E> extends infer Data
		? Data extends { order: infer O extends readonly string[] }
			? string[] extends O
				? UnionToStringTuple<keyof StarColumns<Db, E> & string>
				: ResultKeysOf<Data, NamesIn<O, keyof VisibleColumnsOf<E>>>
			: UnionToStringTuple<keyof StarColumns<Db, E> & string>
		: never

type ResultKeysOf<Data, Names extends readonly string[], Acc extends readonly string[] = []> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? ResultKeysOf<Data, R, [...Acc, JsqlColumnResultKey<Data, H>]>
	: Acc

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

/** A list of one item (an unaliased expression is then named `?column?`). */
type IsSingleItem<Items extends readonly RawSelectItem[]> = Items extends readonly [RawSelectItem] ? true : false

/** `INSERT … SELECT` (#166): the SELECT list needs no output names. */
type IsPositionalSelect<Db> = Db extends { positionalSelect: true } ? true : false

/** The synthetic output name of an unnamed expression of a positional SELECT: unique by the number of items before it. */
type PositionalName<Positional extends boolean, Before extends readonly 1[]> = Positional extends true
	? `__col${Before["length"]}`
	: never

/**
 * The output names of a select list, in order. The loop counts the items with `Before` and reads `Items[Before["length"]]`
 * instead of splitting the tuple, and hands each item to a helper alias as a type argument (#179 item 2): splitting a
 * tuple costs one instantiation per element, a conditional type that infers from an item inside the loop costs a few
 * hundred more per item and step, so a list of N items was quadratic (3.76M instantiations at 320 items).
 */
export type SelectItemNames<
	Items extends readonly RawSelectItem[],
	Scope extends ScopeMap,
	Single extends boolean = IsSingleItem<Items>,
	Acc extends readonly string[] = [],
	Positional extends boolean = false,
	Db = null,
	Before extends readonly 1[] = [],
> = Before["length"] extends Items["length"]
	? Acc
	: ItemNames<Items[Before["length"]], Items, Scope, Single, Acc, Positional, Db, Before>

/** The names of the item `H` after `Acc`, then the rest of the list; the names end at an item that gives no name. */
type ItemNames<
	H,
	Items extends readonly RawSelectItem[],
	Scope extends ScopeMap,
	Single extends boolean,
	Acc extends readonly string[],
	Positional extends boolean,
	Db,
	Before extends readonly 1[],
> = H extends { kind: "param"; param: infer P extends string; as?: infer As }
	? SelectItemNames<Items, Scope, Single, [...Acc, As extends string ? As : P], Positional, Db, [...Before, 1]>
	: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? Ast extends {
				kind: "qualified_table_star"
				schema: infer Sch extends string
				table: infer Tab extends string
			}
			? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E extends ScopeEntry
				? StarNames<Db, E> extends infer T extends readonly string[]
					? SelectItemNames<Items, Scope, Single, [...Acc, ...T], Positional, Db, [...Before, 1]>
					: Acc
				: Acc
			: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
				? Al extends keyof Scope
					? StarNames<Db, Scope[Al]> extends infer T extends readonly string[]
						? SelectItemNames<Items, Scope, Single, [...Acc, ...T], Positional, Db, [...Before, 1]>
						: Acc
					: Acc
				: OutNameFromExprAst<
							Ast,
							ItemAs<H>,
							Single,
							Scope,
							PositionalName<Positional, Before>,
							Db
					  > extends infer O extends string
					? SelectItemNames<Items, Scope, Single, [...Acc, O], Positional, Db, [...Before, 1]>
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
> = ResolveSelectListAcc<Items, Db, Scope, Params, never>

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
	Single extends boolean,
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
					OutNameFromExprAst<Inner, undefined, Single, Scope, Pos, Db>
				: Single extends true
					? "?column?"
					: [Pos] extends [never]
						? "__invalid_select_expr_alias__"
						: Pos

/** First scope entry whose bound table matches `schema.table`. */
type ScopeEntryForQualifiedName<Scope extends ScopeMap, Sch extends string, Tab extends string> = {
	[K in keyof Scope]: Scope[K]["schema"] extends Sch ? (Scope[K]["table"] extends Tab ? Scope[K] : never) : never
}[keyof Scope]

/**
 * What one item adds to the entries: `{ add: entries }`, or the error that ends the list. The loop below hands it each
 * item as a type argument, like {@link SelectItemNames} (an item is never inferred from inside the loop).
 */
type ResolveItem<
	H,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends readonly RawSelectItem[],
	Sqls extends SelectEntry,
	Before extends readonly 1[],
> = H extends { kind: "star" }
	? SingleAliasScope<Scope> extends true
		? ScopeEntryOfSingle<Scope> extends infer E extends ScopeEntry
			? ResolveSelectListAcc<
					Items,
					Db,
					Scope,
					Params,
					Sqls | RecordEntries<StarColumns<KeyDb<Db>, E>>,
					[...Before, 1]
				>
			: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
		: FormatError<Errors["SELECT_STAR_REQUIRES_A_SINGLE_FROM_TABLE"], []>
	: H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? Ast extends {
				kind: "qualified_table_star"
				schema: infer Sch extends string
				table: infer Tab extends string
			}
			? ScopeEntryForQualifiedName<Scope, Sch, Tab> extends infer E
				? E extends ScopeEntry
					? ResolveSelectListAcc<
							Items,
							Db,
							Scope,
							Params,
							Sqls | RecordEntries<StarColumns<KeyDb<Db>, E>>,
							[...Before, 1]
						>
					: FormatError<Errors["UNKNOWN_TABLE"], [Sch, "SELECT ... *"]>
				: FormatError<Errors["UNKNOWN_TABLE"], [Tab, "SELECT ... *"]>
			: Ast extends { kind: "alias_table_star"; alias: infer Al extends string }
				? Al extends keyof Scope
					? Scope[Al] extends infer E extends ScopeEntry
						? ResolveSelectListAcc<
								Items,
								Db,
								Scope,
								Params,
								Sqls | RecordEntries<StarColumns<KeyDb<Db>, E>>,
								[...Before, 1]
							>
						: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
					: FormatError<Errors["UNKNOWN_ALIAS_IN_SELECT_STAR"], []>
				: ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Ev
					? Ev extends DbtyperErrorShape
						? Ev
						: Ev extends SqlTypeShape
							? OutNameFromExprAst<
									Ast,
									ItemAs<H>,
									IsSingleItem<Items>,
									Scope,
									PositionalName<IsPositionalSelect<Db>, Before>,
									KeyDb<Db>
								> extends infer O extends string
								? O extends "__invalid_select_expr_alias__"
									? FormatError<Errors["SCALAR_EXPRESSION_IN_SELECT_REQUIRES_AS_ALIAS"], []>
									: ResolveSelectListAcc<Items, Db, Scope, Params, Sqls | [O, Ev], [...Before, 1]>
								: never
							: never
					: never
		: H extends { kind: "param"; param: infer P extends string; as?: infer As }
			? ResolveParamItem<P, As, Params> extends infer PR
				? PR extends { add: infer Add extends SelectEntry }
					? ResolveSelectListAcc<Items, Db, Scope, Params, Sqls | Add, [...Before, 1]>
					: PR
				: never
			: never

type ResolveParamItem<P extends string, As, Params extends ExpressionParamsShape> =
	LookupSelectParam<Params, P> extends infer PV
		? PV extends DbtyperErrorShape
			? PV
			: PV extends { sql: infer SqlP extends SqlTypeShape }
				? ParamSelectOut<As, P, SqlP> extends {
						out: infer O extends string
						sql: infer Sql extends SqlTypeShape
					}
					? { add: [O, Sql] }
					: never
				: never
		: never

type ResolveSelectListAcc<
	Items extends readonly RawSelectItem[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Sqls extends SelectEntry,
	Before extends readonly 1[] = [],
> = Before["length"] extends Items["length"]
	? { kind: "select"; returning: EntriesToRecord<Sqls> }
	: ResolveItem<Items[Before["length"]], Db, Scope, Params, Items, Sqls, Before>
