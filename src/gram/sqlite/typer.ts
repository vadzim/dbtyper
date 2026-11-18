/**
 * SQLite: grammar-driven typer (track B typing, #55; DECISIONS.md "Grammar-driven typing (#55)").
 *
 * Types the AST that the semantic actions of `actions.ts` build while `Parse` (src/gram/driver.ts) recognises the
 * statement with the SQLite grammar: `CREATE TABLE` changes the database type, `SELECT` gives the row type. There is no
 * second scan of the SQL text; everything comes from the parser's values.
 *
 * Coverage (first slice): CREATE TABLE (column types by affinity, NOT NULL / PRIMARY KEY nullability, WITHOUT ROWID,
 * STRICT, IF NOT EXISTS) and a single SELECT over tables of the database (joins with ON, `*`, `t.*`, column aliases,
 * WHERE / GROUP BY / HAVING / ORDER BY / LIMIT checked) with the CORE nullability rules for literals, operators, CASE,
 * CAST, functions, aggregates, scalar subqueries, EXISTS and IN. Anything else (and any statement this typer would have
 * to reject) is `Unsupported`: the caller then types the whole text with the inherited typer, which also produces the
 * error messages.
 */
import type { JsqlDatabaseShape } from "../../core/jsql-shapes.ts"
import type { JsqlDbReplaceData } from "../../core/jsql-utils.ts"

/** "The grammar typer does not type this (yet)": the caller falls back to the inherited typer. */
export type Unsupported = { readonly __grammarTyperUnsupported: true }

/** Types a parsed statement list (the value of `input`). */
export type SqliteTypeProgram<Db extends JsqlDatabaseShape, Ast> = Ast extends unknown[]
	? Fold<Db, Ast, { returning: null }>
	: Unsupported

type Fold<Db extends JsqlDatabaseShape, Stmts extends unknown[], Result> = Stmts extends [
	infer S,
	...infer Rest extends unknown[],
]
	? S extends ["semi", string]
		? Fold<Db, Rest, Result> // STMT-8: an empty statement does not replace the result
		: Statement<Db, S> extends infer R
			? R extends [infer NewDb extends JsqlDatabaseShape, infer NewResult]
				? Fold<NewDb, Rest, NewResult>
				: Unsupported
			: never
	: [Db, null, Result]

type Statement<Db extends JsqlDatabaseShape, S> = S extends { k: "create_table"; head: infer H; body: infer B }
	? CreateTable<Db, H, B>
	: S extends { k: "select" }
		? Select<Db, [], S> extends infer Row
			? Row extends Unsupported
				? Unsupported
				: [Db, { returning: Row }]
			: never
		: Unsupported

// ---------------------------------------------------------------- shapes

type Shape = { type: string; arg: unknown; nullable: boolean }
type T<Type extends string, Nullable extends boolean> = { type: Type; arg: null; nullable: Nullable }
type Text<Tok> = Tok extends [string, infer X extends string] ? X : never
type AnyNull<S extends Shape[]> = true extends S[number]["nullable"] ? true : false
type AllNull<S extends Shape[]> = false extends S[number]["nullable"] ? false : true
type WithNull<S extends Shape, N extends boolean> = { type: S["type"]; arg: S["arg"]; nullable: N }

/**
 * SQLT-6 (affinity by the declared type name), SQLT-7 (NUMERIC affinity is a JS number: `real`), SQLT-8 (date/time and
 * JSON names are text). No type name: `any` (SQLT-10 is not part of this slice; such a column is not mapped).
 */
type Affinity<Words> =
	JoinWords<Words> extends infer Name extends string
		? Name extends ""
			? "any"
			: Lowercase<Name> extends infer L extends string
				? L extends `${string}int${string}`
					? "integer"
					: L extends `${string}${"char" | "clob" | "text"}${string}`
						? "text"
						: L extends `${string}blob${string}`
							? "blob"
							: L extends `${string}${"real" | "floa" | "doub"}${string}`
								? "real"
								: L extends "date" | "datetime" | "timestamp" | "time" | "json"
									? "text"
									: "real"
				: never
		: never

type JoinWords<Words, Acc extends string = ""> = Words extends [infer W, ...infer Rest]
	? JoinWords<Rest, Acc extends "" ? Text<W> : `${Acc} ${Text<W>}`>
	: Acc

// ---------------------------------------------------------------- CREATE TABLE

type CreateTable<Db extends JsqlDatabaseShape, H, B> = H extends { ifne: infer IfNotExists; nm: infer Nm; dbnm: null }
	? B extends {
			k: "ct_body"
			cols: infer Cols extends unknown[]
			cons: infer Cons extends unknown[]
			opts: infer Opts
		}
		? Text<Nm> extends infer Name extends string
			? Db["defaultSchema"] extends infer Schema extends string
				? HasTable<Db, Schema, Name> extends true
					? IfNotExists extends true
						? [Db, { returning: null }]
						: Unsupported
					: TableOptions<Opts> extends infer O
						? O extends { withoutRowid: infer WR extends boolean; strict: infer ST extends boolean }
							? TablePk<Cons> extends infer Pk
								? Pk extends Unsupported
									? Unsupported
									: Columns<Cols, Pk & string[], WR, ST> extends infer C
										? C extends { columns: infer Columns; facts: infer Facts }
											? [
													JsqlDbReplaceData<
														EnsureSchema<Db, Schema>,
														Schema,
														Name,
														{
															kind: "table"
															columns: Columns & {}
															column_facts: Facts
															constraints: {}
														}
													>,
													{ returning: null },
												]
											: Unsupported
										: never
								: never
							: Unsupported
						: never
				: never
			: never
		: Unsupported
	: Unsupported

type HasTable<Db extends JsqlDatabaseShape, Schema extends string, Name extends string> = Db["schemas"] extends {
	[S in Schema]: { sets: infer Sets }
}
	? Name extends keyof Sets
		? true
		: false
	: false

/** The SQLite chain's default schema exists as soon as a table is created in it (until #100 creates it with the chain). */
type EnsureSchema<Db extends JsqlDatabaseShape, Schema extends string> = Db["schemas"] extends {
	[S in Schema]: unknown
}
	? Db
	: {
			defaultSchema: Db["defaultSchema"]
			schemas: Db["schemas"] & { [S in Schema]: { sets: {}; types: {} } }
			functions: Db["functions"]
		}

type TableOptions<Opts, WR extends boolean = false, ST extends boolean = false> = Opts extends [infer O, ...infer Rest]
	? O extends { k: "without"; nm: ["id", "rowid"] }
		? TableOptions<Rest, true, ST>
		: O extends ["id", "strict"]
			? TableOptions<Rest, WR, true>
			: Unsupported
	: Opts extends []
		? { withoutRowid: WR; strict: ST }
		: Unsupported

/** The column names of a table-level PRIMARY KEY (plain column names only), `[]` without one. */
type TablePk<Cons> = Cons extends [infer C, ...infer Rest]
	? C extends { c: "pk"; cols: infer Cols }
		? PkNames<Cols>
		: C extends { c: string }
			? TablePk<Rest>
			: Unsupported
	: []

type PkNames<Cols, Acc extends string[] = []> = Cols extends [infer E, ...infer Rest]
	? E extends [string, infer Name extends string]
		? PkNames<Rest, [...Acc, Name]>
		: Unsupported
	: Acc

type Columns<
	Cols extends unknown[],
	Pk extends string[],
	WithoutRowid extends boolean,
	Strict extends boolean,
	Cols0 = {},
	Facts = {},
> = Cols extends [infer Col, ...infer Rest]
	? Col extends { k: "column"; name: infer Nm; type: infer Words; cons: infer Cons extends unknown[] }
		? Text<Nm> extends infer Name extends string
			? ColumnFlags<Cons> extends infer Flags
				? Flags extends { notNull: infer NN extends boolean; pk: infer P; def: infer D extends boolean }
					? Affinity<Words> extends infer Type extends string
						? // SQLT-13: exactly INTEGER PRIMARY KEY (not DESC) in a rowid table is the rowid
							(
								WithoutRowid extends true
									? false
									: JoinWords<Words> extends "integer"
										? P extends "asc"
											? true
											: Pk extends [Name]
												? true
												: false
										: false
							) extends infer Rowid extends boolean
							? // CORE-1 / SQLT-14: another PRIMARY KEY column is NOT NULL only in WITHOUT ROWID or STRICT tables
								(
									NN extends true
										? true
										: Rowid extends true
											? true
											: P extends "asc" | "desc"
												? WithoutRowid extends true
													? true
													: Strict
												: Name extends Pk[number]
													? WithoutRowid extends true
														? true
														: Strict
													: false
								) extends infer NotNull extends boolean
								? Columns<
										Rest extends unknown[] ? Rest : [],
										Pk,
										WithoutRowid,
										Strict,
										Cols0 & { [K in Name]: T<Type, NotNull extends true ? false : true> },
										D extends true
											? Facts & { [K in Name]: { default: true } }
											: Rowid extends true
												? Facts & { [K in Name]: { default: true } }
												: Facts
									>
								: never
							: never
						: never
					: Unsupported
				: never
			: never
		: Unsupported
	: { columns: { [K in keyof Cols0]: Cols0[K] }; facts: { [K in keyof Facts]: Facts[K] } }

/** `pk`: "asc" / "desc" for a column PRIMARY KEY, or null. */
type ColumnFlags<
	Cons extends unknown[],
	NN extends boolean = false,
	P = null,
	D extends boolean = false,
> = Cons extends [infer C, ...infer Rest extends unknown[]]
	? C extends { c: "notnull" }
		? ColumnFlags<Rest, true, P, D>
		: C extends { c: "pk"; order: infer O }
			? ColumnFlags<Rest, NN, O extends ["desc", string] ? "desc" : "asc", D>
			: C extends { c: "default" }
				? ColumnFlags<Rest, NN, P, true>
				: C extends { c: string }
					? ColumnFlags<Rest, NN, P, D>
					: Unsupported
	: { notNull: NN; pk: P; def: D }

// ---------------------------------------------------------------- SELECT

/** One FROM entry: its name in the query (alias or table name), columns, and whether an outer join makes it nullable. */
type Entry = { name: string; cols: Record<string, Shape>; nullable: boolean }
/** Scope levels, innermost first (a subquery sees the columns of the queries around it). */
type Scope = Entry[][]

/** `Sub`: a subquery, whose output columns need no names (their names are never seen). */
type Select<Db extends JsqlDatabaseShape, Outer extends Scope, S, Sub extends boolean = false> = S extends {
	k: "select"
	cols: infer Cols
	from: infer From
	where: infer Where
	group: infer Group
	having: infer Having
	order: infer Order
	limit: infer Limit
}
	? FromEntries<Db, From> extends infer Level
		? Level extends { entries: infer Entries extends Entry[]; on: infer On extends unknown[] }
			? [Entries, ...Outer] extends infer Sc extends Scope
				? Check<
						Db,
						Sc,
						[...On, Where, Having, ...(Group extends unknown[] ? Group : [Group]), ...ListOrNull<Limit>]
					> extends true
					? Output<Db, Sc, Cols, Sub> extends infer Row
						? Row extends Unsupported
							? Unsupported
							: CheckOrder<Db, Sc, Order, keyof Row> extends true
								? Row
								: Unsupported
						: never
					: Unsupported
				: never
			: Unsupported
		: never
	: Unsupported

type ListOrNull<X> = X extends unknown[] ? X : []

/** Every expression (null = absent clause) types without Unsupported. */
type Check<Db extends JsqlDatabaseShape, Sc extends Scope, Exprs extends unknown[]> = Exprs extends [
	infer E,
	...infer Rest,
]
	? E extends null
		? Check<Db, Sc, Rest>
		: Expr<Db, Sc, E> extends Unsupported
			? Unsupported
			: Check<Db, Sc, Rest>
	: true

/** ORDER BY may also name an output column. */
type CheckOrder<Db extends JsqlDatabaseShape, Sc extends Scope, Order, Names> = Order extends [infer E, ...infer Rest]
	? E extends [string, infer Name extends string]
		? Name extends Names
			? CheckOrder<Db, Sc, Rest, Names>
			: Expr<Db, Sc, E> extends Unsupported
				? Unsupported
				: CheckOrder<Db, Sc, Rest, Names>
		: Expr<Db, Sc, E> extends Unsupported
			? Unsupported
			: CheckOrder<Db, Sc, Rest, Names>
	: Order extends [] | null
		? true
		: Unsupported

/** The FROM list as scope entries plus its ON conditions; SEL-18 outer-join nullability. */
type FromEntries<
	Db extends JsqlDatabaseShape,
	From,
	Entries extends Entry[] = [],
	On extends unknown[] = [],
> = From extends [infer Item, ...infer Rest]
	? Item extends { k: "from"; join: infer Join; nm: infer Nm; dbnm: infer Dbnm; as: infer As; on: infer O }
		? (Dbnm extends null ? [Db["defaultSchema"], Text<Nm>] : [Text<Nm>, Text<Dbnm>]) extends [
				infer Schema extends string,
				infer Table extends string,
			]
			? TableColumns<Db, Schema, Table> extends infer Cols
				? Cols extends Record<string, Shape>
					? JoinKind<Join> extends infer Kind
						? Kind extends "inner" | "left" | "right" | "full"
							? (
									O extends null ? On : O extends { on: infer E } ? [...On, E] : Unsupported
								) extends infer NewOn
								? NewOn extends unknown[]
									? FromEntries<
											Db,
											Rest,
											[
												...(Kind extends "right" | "full" ? NullableAll<Entries> : Entries),
												{
													name: As extends null ? Table : Text<As>
													cols: Cols
													nullable: Kind extends "left" | "full" ? true : false
												},
											],
											NewOn
										>
									: Unsupported
								: never
							: Unsupported
						: never
					: Unsupported
				: never
			: never
		: Unsupported
	: From extends []
		? { entries: Entries; on: On }
		: Unsupported

type TableColumns<Db extends JsqlDatabaseShape, Schema extends string, Table extends string> = Db["schemas"] extends {
	[S in Schema]: { sets: infer Sets }
}
	? Sets extends { [K in Table]: { columns: infer Cols } }
		? Cols
		: Unsupported
	: Unsupported

type NullableAll<Entries extends Entry[]> = {
	[I in keyof Entries]: { name: Entries[I]["name"]; cols: Entries[I]["cols"]; nullable: true }
}

/** `null` (first table), `,`, `JOIN`, `JOIN_KW [nm [nm]] JOIN`: NATURAL (CORE-9) is not in this slice. */
type JoinKind<Join> = Join extends null | ["comma", string] | ["join", string]
	? "inner"
	: Join extends { k: "join"; words: infer Words extends unknown[] }
		? JoinWords<Words> extends infer W extends string
			? W extends "inner" | "cross"
				? "inner"
				: W extends "left" | "left outer"
					? "left"
					: W extends "right" | "right outer"
						? "right"
						: W extends "full" | "full outer"
							? "full"
							: Unsupported
			: never
		: Unsupported

/** The output columns: `*` (one table only: bare `*` over joins is SEL-6), `t.*`, expressions with a name. */
type Output<
	Db extends JsqlDatabaseShape,
	Sc extends Scope,
	Cols,
	Sub extends boolean,
	Acc extends [string, Shape][] = [],
> = Cols extends [infer C, ...infer Rest]
	? (
			C extends { k: "star"; t: null }
				? Sc[0] extends [infer Only extends Entry]
					? EntryColumns<Only>
					: Unsupported
				: C extends { k: "star"; t: infer TableTok }
					? FindEntry<Sc[0], Text<TableTok>> extends infer E
						? E extends Entry
							? EntryColumns<E>
							: Unsupported
						: never
					: C extends { k: "rc"; e: infer E; as: infer As }
						? Expr<Db, Sc, E> extends infer Type
							? Type extends Shape
								? OutputName<E, As> extends infer Name extends string
									? [[Name, Type]]
									: Sub extends true
										? [[`#${Acc["length"]}`, Type]]
										: Unsupported
								: Unsupported
							: never
						: Unsupported
		) extends infer Columns
		? Columns extends [string, Shape][]
			? Columns[number][0] & Acc[number][0] extends never
				? Output<Db, Sc, Rest, Sub, [...Acc, ...Columns]>
				: Unsupported // a duplicate output name (CORE-11) is the inherited typer's error
			: Unsupported
		: never
	: Cols extends []
		? { [P in Acc[number] as P[0]]: P[1] }
		: Unsupported

type EntryColumns<E extends Entry> = TupleOfColumns<E["cols"], E["nullable"]>
type TupleOfColumns<Cols extends Record<string, Shape>, Nullable extends boolean> = UnionToTuple<
	{ [K in keyof Cols & string]: [K, Nullable extends true ? WithNull<Cols[K], true> : Cols[K]] }[keyof Cols & string]
>
type UnionToTuple<U> = (U extends unknown ? (x: () => U) => void : never) extends (x: infer I) => void
	? I extends () => infer Last
		? [...UnionToTuple<Exclude<U, Last>>, Last]
		: []
	: []

/** An alias, or the column name of a bare column reference; other unnamed expressions are not in this slice. */
type OutputName<E, As> = As extends null
	? E extends [infer Term extends string, infer Name extends string]
		? Term extends LiteralTerminal
			? Unsupported
			: Name
		: E extends { k: "col"; c: infer C }
			? Text<C>
			: Unsupported
	: Text<As>

type FindEntry<Entries, Name extends string> = Entries extends [infer E extends Entry, ...infer Rest]
	? E["name"] extends Name
		? E
		: FindEntry<Rest, Name>
	: Unsupported

// ---------------------------------------------------------------- expressions

type LiteralTerminal = "integer" | "float" | "string" | "null" | "blob" | "ctime_kw" | "variable"

/** The type of an expression node (CORE-2…CORE-5), or Unsupported. */
type Expr<Db extends JsqlDatabaseShape, Sc extends Scope, E> = E extends [
	infer Term extends string,
	infer Txt extends string,
]
	? Leaf<Sc, Term, Txt>
	: E extends { k: "col"; t: infer Tbl; c: infer C }
		? E extends { s: unknown }
			? Unsupported
			: Qualified<Sc, Text<Tbl>, Text<C>>
		: E extends { k: "op"; op: infer Op; l: infer L; r: infer R }
			? Binary<
					Op,
					Expr<Db, Sc, L>,
					Expr<Db, Sc, R>,
					E extends { esc: infer Esc } ? Expr<Db, Sc, Esc> : T<"null", false>
				>
			: E extends { k: "un"; op: infer Op; x: infer X }
				? Unary<Op, Expr<Db, Sc, X>>
				: E extends { k: "between"; x: infer X; lo: infer Lo; hi: infer Hi }
					? Predicate<[Expr<Db, Sc, X>, Expr<Db, Sc, Lo>, Expr<Db, Sc, Hi>]>
					: E extends { k: "in"; x: infer X; list: infer List }
						? List extends unknown[]
							? Predicate<[Expr<Db, Sc, X>, ...Exprs<Db, Sc, List>]>
							: Unsupported
						: E extends { k: "in_sel"; x: infer X; sel: infer Sel }
							? SubqueryColumn<Db, Sc, Sel> extends infer C
								? C extends Shape
									? Predicate<[Expr<Db, Sc, X>, C]>
									: Unsupported
								: never
							: E extends { k: "sub"; sel: infer Sel }
								? SubqueryColumn<Db, Sc, Sel> extends infer C
									? C extends Shape
										? WithNull<C, true> // CORE-4: it may return no row
										: Unsupported
									: never
								: E extends { k: "exists"; sel: infer Sel }
									? Select<Db, Sc, Sel, true> extends Unsupported
										? Unsupported
										: T<"integer", false> // CORE-4
									: E extends { k: "cast"; x: infer X; type: infer Words }
										? Expr<Db, Sc, X> extends infer S
											? S extends Shape
												? T<Affinity<Words>, S["nullable"]>
												: Unsupported
											: never
										: E extends {
													k: "case"
													operand: infer Op
													whens: infer Whens
													else: infer Else
											  }
											? Case<Db, Sc, Op, Whens, Else>
											: E extends { k: "fn"; name: infer Name; args: infer Args }
												? Call<Db, Sc, Lowercase<Text<Name>>, Args>
												: Unsupported

type Exprs<Db extends JsqlDatabaseShape, Sc extends Scope, List extends unknown[]> = {
	[I in keyof List]: Expr<Db, Sc, List[I]>
}

/** SQLT-9: comparison results are integers 0/1. CORE-5: the literal NULL alone is `null`. */
type Leaf<Sc extends Scope, Term extends string, Txt extends string> = Term extends "integer"
	? T<"integer", false>
	: Term extends "float"
		? T<"real", false>
		: Term extends "string" | "ctime_kw"
			? T<"text", false>
			: Term extends "null"
				? T<"null", true>
				: Term extends "blob"
					? T<"blob", false>
					: Term extends "variable"
						? Unsupported // parameters: the inherited typer (CORE-6/7 are #57/#58)
						: Unqualified<Sc, Txt>

type Unqualified<Sc extends Scope, Name extends string> = Sc extends [
	infer Level extends Entry[],
	...infer Outer extends Scope,
]
	? Matches<Level, Name> extends infer M extends Shape[]
		? M extends [infer Only extends Shape]
			? Only
			: M extends []
				? Unqualified<Outer, Name>
				: Unsupported // ambiguous: the inherited typer's error
		: never
	: Name extends "true" | "false"
		? T<"integer", false> // SQLT-9
		: Unsupported

type Matches<Level extends Entry[], Name extends string, Acc extends Shape[] = []> = Level extends [
	infer E extends Entry,
	...infer Rest extends Entry[],
]
	? E["cols"] extends { [K in Name]: infer C extends Shape }
		? Matches<Rest, Name, [...Acc, E["nullable"] extends true ? WithNull<C, true> : C]>
		: Matches<Rest, Name, Acc>
	: Acc

type Qualified<Sc extends Scope, Table extends string, Name extends string> = Sc extends [
	infer Level extends Entry[],
	...infer Outer extends Scope,
]
	? FindEntry<Level, Table> extends infer E
		? E extends Entry
			? E["cols"] extends { [K in Name]: infer C extends Shape }
				? E["nullable"] extends true
					? WithNull<C, true>
					: C
				: Unsupported
			: Qualified<Outer, Table, Name>
		: never
	: Unsupported

/** CORE-2: nullable when an operand is; `IS` is null-aware. */
type Binary<Op, L, R, Esc> = L extends Shape
	? R extends Shape
		? Esc extends Shape
			? Op extends "is"
				? T<"integer", false>
				: AnyNull<[L, R, Esc]> extends infer N extends boolean
					? Op extends "concat"
						? T<"text", N>
						: Op extends "arith"
							? T<Arith<L["type"], R["type"]>, N>
							: T<"integer", N> // cmp, bit, AND/OR, LIKE: integers (SQLT-9)
					: never
			: Unsupported
		: Unsupported
	: Unsupported

type Arith<A extends string, B extends string> = A extends "null"
	? B
	: B extends "null"
		? A
		: [A, B] extends ["integer", "integer"]
			? "integer"
			: "real"

type Unary<Op, X> = X extends Shape
	? Op extends "isnull"
		? T<"integer", false>
		: Op extends "neg" | "pos"
			? X
			: T<"integer", X["nullable"]> // NOT, ~
	: Unsupported

type Predicate<Operands extends unknown[]> = Operands extends Shape[] ? T<"integer", AnyNull<Operands>> : Unsupported

/** The only column of a subquery (a correlated one sees the outer scope). */
type SubqueryColumn<Db extends JsqlDatabaseShape, Sc extends Scope, Sel> =
	Select<Db, Sc, Sel, true> extends infer Row
		? Row extends Unsupported
			? Unsupported
			: UnionToTuple<Row[keyof Row]> extends [infer Only extends Shape]
				? Only
				: Unsupported
		: never

/** CORE-2: CASE is nullable when a branch is or there is no ELSE; the type is the first non-NULL branch's. */
type Case<Db extends JsqlDatabaseShape, Sc extends Scope, Operand, Whens, Else> = Whens extends [unknown, unknown][]
	? (Operand extends null ? true : Expr<Db, Sc, Operand> extends Shape ? true : false) extends true
		? Exprs<Db, Sc, { [I in keyof Whens]: Whens[I] extends [infer C, unknown] ? C : never }> extends Shape[]
			? [
					...Exprs<Db, Sc, { [I in keyof Whens]: Whens[I] extends [unknown, infer V] ? V : never }>,
					Else extends null ? T<"null", true> : Expr<Db, Sc, Else>,
				] extends infer Branches
				? Branches extends Shape[]
					? FirstNonNull<Branches> extends infer Type extends string
						? T<Type, AnyNull<Branches>>
						: never
					: Unsupported
				: never
			: Unsupported
		: Unsupported
	: Unsupported

type FirstNonNull<S extends Shape[]> = S extends [infer F extends Shape, ...infer Rest extends Shape[]]
	? F["type"] extends "null"
		? FirstNonNull<Rest>
		: F["type"]
	: "null"

/** Functions (SQLT-47 aggregates, CORE-3; a few scalars). Others are not in this slice. */
type Call<Db extends JsqlDatabaseShape, Sc extends Scope, Name extends string, Args> = Args extends "*"
	? Name extends "count"
		? T<"integer", false>
		: Unsupported
	: Args extends unknown[]
		? Exprs<Db, Sc, Args> extends infer A
			? A extends Shape[]
				? CallTyped<Name, A>
				: Unsupported
			: never
		: Unsupported

type CallTyped<Name extends string, A extends Shape[]> = Name extends "count"
	? T<"integer", false> // CORE-3
	: Name extends "sum"
		? A extends [infer X extends Shape]
			? T<X["type"] extends "integer" ? "integer" : "real", true> // SQLT-47, CORE-3
			: Unsupported // sum() without argument: FN-24's error comes from the inherited typer
		: Name extends "avg"
			? A extends [Shape]
				? T<"real", true>
				: Unsupported
			: Name extends "total"
				? A extends [Shape]
					? T<"real", false>
					: Unsupported
				: Name extends "min" | "max"
					? A extends [infer X extends Shape]
						? WithNull<X, true> // CORE-3: NULL over no rows
						: A extends [Shape, Shape, ...Shape[]]
							? T<FirstNonNull<A>, AnyNull<A>>
							: Unsupported
					: Name extends "group_concat" | "string_agg"
						? T<"text", true>
						: Name extends "coalesce" | "ifnull"
							? A extends [Shape, Shape, ...Shape[]]
								? T<FirstNonNull<A>, AllNull<A>> // CORE-2, CORE-5
								: Unsupported
							: Name extends "nullif"
								? A extends [infer X extends Shape, Shape]
									? WithNull<X, true>
									: Unsupported
								: Name extends "abs"
									? A extends [infer X extends Shape]
										? X
										: Unsupported
									: Name extends "typeof"
										? T<"text", false>
										: Name extends "random"
											? T<"integer", false>
											: Name extends ScalarText
												? T<"text", AnyNull<A>>
												: Name extends "length" | "instr" | "unicode"
													? T<"integer", AnyNull<A>>
													: Name extends "round"
														? T<"real", AnyNull<A>>
														: Unsupported

type ScalarText = "upper" | "lower" | "trim" | "ltrim" | "rtrim" | "replace" | "substr" | "substring" | "hex" | "char"
