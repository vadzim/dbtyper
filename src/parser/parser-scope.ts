import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { SqliteRowidNames } from "../core/dialect-types.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FoldAsciiCase } from "../lexer/sql-lexer-chars.ts"

/** One FROM/JOIN alias bound to a concrete table shape (columns as SQL type strings). */
export type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlDataShape["columns"]
	/** CORE-9: columns merged away by `JOIN … USING` / `NATURAL JOIN`: hidden from unqualified lookup and `alias.*`. */
	hidden?: string
	/** A CTE or subquery: its output names where they differ from the keys (SQLite, {@link OutputRelation}). */
	spelled?: unknown
	/** A CTE or subquery: its output order (DML-20), which `*` follows. */
	order?: unknown
}

/** Union of the hidden column names of a scope entry (`never` when none). */
export type HiddenColumnsOf<E> = E extends { hidden: infer H extends string } ? H : never

/** SQLT-15: a rowid pseudo-column: selectable by name, never part of `*`. */
type RowidColumnShape<Key extends string> = { type: "integer"; arg: null; nullable: false; pseudo: true; rowidKey: Key }

/**
 * The columns a FROM item of this table exposes by name: its own, plus `rowid`, `oid` and `_rowid_` for a SQLite
 * table with a rowid, unless a real column has that name (SQLT-15).
 */
export type TableScopeColumns<Tbl extends JsqlDataShape> = Tbl extends { rowid_table: true }
	? Tbl["columns"] & {
			[N in SqliteRowidNames as N extends keyof Tbl["columns"] ? never : N]: RowidColumnShape<
				Tbl extends { rowid_alias: infer A extends string } ? A : N
			>
		}
	: Tbl["columns"]

/** Columns of an entry as `alias.*` and a bare `*` expand them (CORE-9: merged join columns appear once). */
export type VisibleColumnsOf<E extends ScopeEntry> = [HiddenColumnsOf<E> | RowidNamesIn<E["columns"]>] extends [never]
	? E["columns"]
	: {
			[
				C in keyof E["columns"] as C extends HiddenColumnsOf<E> | RowidNamesIn<E["columns"]> ? never : C
			]: E["columns"][C]
		}

/** The rowid pseudo-column names among `Cols` (`never` for any table without them: a cheap key test). */
type RowidNamesIn<Cols> = {
	[N in Extract<keyof Cols, SqliteRowidNames>]: Cols[N] extends { pseudo: true } ? N : never
}[Extract<keyof Cols, SqliteRowidNames>]

/**
 * Map alias → scope entry (one lexical layer: merge scopes as parsing descends).
 * Use `Record<string, ScopeEntry>` (not a `readonly` index signature) so intersections like
 * `Record<"t1", E1> & Record<"t2", E2>` stay assignable and keep literal keys for `keyof`.
 */
export type ScopeMap = Record<string, ScopeEntry>

/**
 * Merge two scopes with proper shadowing: Inner scope shadows/hides Outer scope.
 * If both scopes have the same alias, Inner wins (standard lexical scoping).
 */
export type MergeScope<Inner extends ScopeMap, Outer extends ScopeMap> = Inner & Omit<Outer, keyof Inner>

/** Scope entry of an enclosing query level; `outerDepth` is a tuple whose length is the nesting distance. */
type ScopeEntryOuterDepth<E> = E extends { outerDepth: infer D extends readonly 1[] } ? D : readonly []

/**
 * Mark every entry of `Outer` as belonging to one level further out (SEL-24), so unqualified column
 * lookup prefers the innermost level that has the column. Qualified lookups are unaffected.
 */
export type MarkOuterScope<Outer extends ScopeMap> = {
	[K in keyof Outer]: {
		schema: Outer[K]["schema"]
		table: Outer[K]["table"]
		columns: Outer[K]["columns"]
		outerDepth: readonly [...ScopeEntryOuterDepth<Outer[K]>, 1]
		hidden?: HiddenColumnsOf<Outer[K]>
	}
}

/** Drop scope entries that are CTE definitions (not FROM items): they are visible by name only. */
export type FromItemsOnly<Scope extends ScopeMap> = {
	[K in keyof Scope as Scope[K]["schema"] extends "__cte__" ? never : K]: Scope[K]
}

/**
 * SQLT-15: the result key of an unaliased `rowid`/`oid`/`_rowid_` read as `Parts` in `Scope`: the rowid alias column's
 * name when the table has one, else `Written`. A cheap name test first, so other columns cost nothing.
 */
export type RowidResultKey<Parts extends readonly string[], Scope extends ScopeMap, Written extends string> =
	Lowercase<Written> extends SqliteRowidNames
		? Parts extends readonly [...infer _Q, infer C extends string]
			? Parts extends readonly [infer T extends string, string]
				? RowidKeyIn<T extends keyof Scope ? Scope[T]["columns"] : never, Lowercase<C>, Written>
				: RowidKeyIn<Scope[keyof Scope]["columns"], Lowercase<C>, Written>
			: Written
		: Written

type RowidKeyIn<Cols, C extends string, Written extends string> = C extends keyof Cols
	? Cols[C] extends { pseudo: true; rowidKey: infer K extends string }
		? K extends C
			? Written
			: K
		: Written
	: Written

/**
 * The columns of a view, CTE or subquery made from the SELECT result `Res`, with its output order (DML-20) when the
 * result has one. Where names match case-insensitively (SQLite, fact `foldQuoted`) they are keyed by the folded name,
 * as a table's are, and the output names are kept as declared spellings (`spelled`, SQLT-67), so `select mixed from v`
 * finds `Mixed` and still returns `Mixed`.
 */
export type OutputRelation<Db extends JsqlDatabaseShape, Ret extends Record<string, SqlTypeShape>, Order> = DialectFact<
	Db,
	"lexer"
>["foldQuoted"] extends true
	? { columns: { [K in keyof Ret & string as FoldAsciiCase<K>]: Ret[K] } } & (Order extends readonly string[]
			? { order: FoldedNames<Order> }
			: {}) &
			({ [K in keyof Ret & string as FoldAsciiCase<K> extends K ? never : FoldAsciiCase<K>]: K } extends infer Sp
				? {} extends Sp
					? {}
					: { spelled: Sp }
				: never)
	: { columns: Ret } & (Order extends readonly string[] ? { order: Order } : {})

/** The SELECT result's output order, or `null`. */
export type OutputOrder<Res> = Res extends { order: infer O extends readonly string[] } ? O : null

/** Each name folded as a SQLite name ({@link FoldAsciiCase}). */
export type FoldedNames<Names extends readonly string[], Acc extends readonly string[] = []> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? FoldedNames<R, [...Acc, FoldAsciiCase<H>]>
	: Acc
