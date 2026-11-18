/**
 * Parameter types come from the SQL, not from the passed values (CORE-6, CORE-7).
 *
 * The statement's tokens are scanned for each `:name`, `?` and `$n` and the SQL type is taken from the place where
 * the parameter stands:
 *   - `column <op> :p`, `:p <op> column` (comparison, arithmetic on a numeric column, LIKE);
 *   - `column IN (:a, :b)`, `column BETWEEN :a AND :b`;
 *   - `INSERT INTO t (c1, c2) VALUES (:a, :b)` and `UPDATE … SET c = :p` (the column's type, with `null` for a
 *     nullable column);
 *   - `CAST(:p AS type)` and `:p::type`;
 *   - `LIMIT :n`, `OFFSET :n`.
 * A parameter standing anywhere else has no derivable type (CORE-7), see DECISIONS.md.
 */
import type { JsqlDataShape, JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { JsqlDbGetData } from "./jsql-utils.ts"
import type {
	ReadTokenFromString,
	TokenEot,
	TokenIdent,
	TokenIndexedParam,
	TokenKey,
	TokenParam,
} from "../lexer/sql-lexer.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, SqlCastTypeNorm } from "../parser/parse-expression.ts"
import type { ResolveCastFromShape } from "../parser/parse-expression.ts"
import type { SqlInteger, SqlText, SqlTypeShape } from "./sql-type-shape.ts"
import type { Inc, ParseNumber } from "./type-utils.ts"

type Tk = { kind: string; value: string }

/** The tokens of `Text` (the lexer without the parser monad); `?` gets its 1-based position like in the monad. */
type Tokenize<
	Text extends string,
	Syntax extends string,
	Acc extends readonly Tk[] = [],
	Pos extends readonly unknown[] = [],
> =
	ReadTokenFromString<Text, Syntax> extends [infer T, infer Rest extends string, ...unknown[]]
		? T extends TokenEot
			? Acc
			: T extends TokenKey<"?">
				? "question-params" extends Syntax
					? Tokenize<
							Rest,
							Syntax,
							[...Acc, TokenIndexedParam<`${[...Pos, unknown]["length"]}`>],
							[...Pos, unknown]
						>
					: Tokenize<Rest, Syntax, [...Acc, T], Pos>
				: T extends Tk
					? Tokenize<Rest, Syntax, [...Acc, T], Pos>
					: Acc
		: Acc

type Table = { alias: string; columns: Record<string, SqlTypeShape> }

/** Tables named after FROM / JOIN / UPDATE / INTO (`[schema.]table [[AS] alias]`). */
type CollectTables<
	Db extends JsqlDatabaseShape,
	Toks extends readonly Tk[],
	Acc extends readonly Table[] = [],
> = Toks extends readonly [infer H, ...infer R extends readonly Tk[]]
	? H extends TokenKey<"from" | "join" | "update" | "into">
		? TableAfter<Db, R> extends [infer Tbl extends Table, infer Rest extends readonly Tk[]]
			? CollectTables<Db, Rest, [...Acc, Tbl]>
			: CollectTables<Db, R, Acc>
		: CollectTables<Db, R, Acc>
	: Acc

type TableAfter<Db extends JsqlDatabaseShape, R extends readonly Tk[]> = R extends readonly [
	TokenIdent<infer A>,
	TokenKey<".">,
	TokenIdent<infer B>,
	...infer R2 extends readonly Tk[],
]
	? TableWithAlias<JsqlDbGetData<Db, A, B>, B, R2>
	: R extends readonly [TokenIdent<infer A>, ...infer R2 extends readonly Tk[]]
		? TableWithAlias<JsqlDbGetData<Db, Db["defaultSchema"], A>, A, R2>
		: never

type TableWithAlias<Data, Name extends string, R extends readonly Tk[]> = Data extends JsqlDataShape
	? R extends readonly [TokenKey<"as">, TokenIdent<infer Al>, ...infer R2 extends readonly Tk[]]
		? [{ alias: Al; columns: Data["columns"] }, R2]
		: R extends readonly [TokenIdent<infer Al>, ...infer R2 extends readonly Tk[]]
			? [{ alias: Al; columns: Data["columns"] }, R2]
			: [{ alias: Name; columns: Data["columns"] }, R]
	: never

/** Type of `qualifier.column` or of an unqualified `column` in the collected tables; `never` when unknown. */
type ColumnIn<
	Tables extends readonly Table[],
	Qual extends string | null,
	Col extends string,
> = Tables extends readonly [infer T extends Table, ...infer Rest extends readonly Table[]]
	? (Qual extends string ? (T["alias"] extends Qual ? true : false) : true) extends true
		? Col extends keyof T["columns"]
			? T["columns"][Col]
			: ColumnIn<Rest, Qual, Col>
		: ColumnIn<Rest, Qual, Col>
	: never

/** The column named by the identifier chain ENDING the reversed token list (`[col, ".", qual, …]`). */
type ColumnOfBack<Tables extends readonly Table[], Back extends readonly Tk[]> = Back extends readonly [
	TokenIdent<infer C>,
	TokenKey<".">,
	TokenIdent<infer Q>,
	...Tk[],
]
	? ColumnIn<Tables, Q, C>
	: Back extends readonly [TokenIdent<infer C>, ...Tk[]]
		? ColumnIn<Tables, null, C>
		: never

/** The column named by the identifier chain STARTING the token list; a function call is not a column. */
type ColumnOfFront<Tables extends readonly Table[], R extends readonly Tk[]> = R extends readonly [
	TokenIdent<infer Q>,
	TokenKey<".">,
	TokenIdent<infer C>,
	...Tk[],
]
	? ColumnIn<Tables, Q, C>
	: R extends readonly [TokenIdent<infer C>, infer Next, ...Tk[]]
		? Next extends TokenKey<"(">
			? never
			: ColumnIn<Tables, null, C>
		: R extends readonly [TokenIdent<infer C>]
			? ColumnIn<Tables, null, C>
			: never

type CompareOp = "=" | "<>" | "!=" | "<" | ">" | "<=" | ">=" | "like" | "ilike" | "~" | "~*" | "!~" | "!~*"
type ArithOp = "+" | "-" | "*" | "/" | "%"
type NumericTypeName = "integer" | "bigint" | "smallint" | "numeric" | "real" | "double precision"

type NonNull<S extends SqlTypeShape> = { type: S["type"]; arg: S["arg"]; nullable: false }

/** Column type for `column <op> param`: arithmetic only on a numeric column. */
type OperandType<Op extends string, S> = [S] extends [never]
	? never
	: S extends SqlTypeShape
		? Op extends CompareOp
			? S
			: S["type"] extends NumericTypeName
				? S
				: never
		: never

type Words<R extends readonly Tk[], Acc extends readonly string[] = []> = R extends readonly [
	infer T,
	...infer Rest extends readonly Tk[],
]
	? T extends TokenIdent<infer W>
		? Words<Rest, [...Acc, W]>
		: T extends TokenKey<infer K extends "with" | "without" | "time" | "zone" | "varying" | "precision" | "double">
			? Words<Rest, [...Acc, K]>
			: Acc
	: Acc

/** The shape a type name in CAST / `::` stands for. */
type CastTarget<R extends readonly Tk[]> =
	Words<R> extends infer W extends readonly string[]
		? W extends readonly []
			? never
			: ResolveCastFromShape<SqlText, SqlCastTypeNorm<W>> extends infer S
				? S extends SqlTypeShape
					? S
					: never
				: never
		: never

type Ctx = {
	/** `IN (` list: the column type of the left side. */
	inList: SqlTypeShape | null
	/** between `SET` and `WHERE`/`FROM`/`RETURNING`: the column's nullability is kept. */
	inSet: boolean
	/** column types of `INSERT INTO t (c1, c2)`; null when no such statement */
	insert: readonly SqlTypeShape[] | null
	/** inside `VALUES (`: paren depth and position in the row, as tuple lengths */
	values: { depth: readonly unknown[]; pos: readonly unknown[] } | null
}

/** Column types of `INSERT INTO [s.]t (c1, c2, …)` in column-list order. */
type InsertColumns<Db extends JsqlDatabaseShape, Toks extends readonly Tk[]> = Toks extends readonly [
	TokenKey<"insert">,
	TokenKey<"into">,
	...infer R extends readonly Tk[],
]
	? R extends readonly [
			TokenIdent<infer A>,
			TokenKey<".">,
			TokenIdent<infer B>,
			TokenKey<"(">,
			...infer R2 extends readonly Tk[],
		]
		? InsertColumnList<JsqlDbGetData<Db, A, B>, R2>
		: R extends readonly [TokenIdent<infer A>, TokenKey<"(">, ...infer R2 extends readonly Tk[]]
			? InsertColumnList<JsqlDbGetData<Db, Db["defaultSchema"], A>, R2>
			: null
	: Toks extends readonly [Tk, ...infer R extends readonly Tk[]]
		? InsertColumns<Db, R>
		: null

type InsertColumnList<
	Data,
	R extends readonly Tk[],
	Acc extends readonly SqlTypeShape[] = [],
> = Data extends JsqlDataShape
	? R extends readonly [TokenIdent<infer C>, ...infer R2 extends readonly Tk[]]
		? C extends keyof Data["columns"]
			? R2 extends readonly [TokenKey<",">, ...infer R3 extends readonly Tk[]]
				? InsertColumnList<Data, R3, [...Acc, Data["columns"][C]]>
				: [...Acc, Data["columns"][C]]
			: null
		: null
	: null

/** The type of the parameter token `P` given what stands before (`Back`, reversed) and after (`R`) it. */
type DeriveParam<
	Tables extends readonly Table[],
	C extends Ctx,
	Back extends readonly Tk[],
	R extends readonly Tk[],
> = FirstOf<
	[
		DeriveLeft<Tables, C, Back>,
		DeriveRight<Tables, R>,
		DeriveCast<Back, R>,
		DeriveInsert<C, Back>,
		DeriveInList<C, Back>,
	]
>

type FirstOf<L extends readonly unknown[]> = L extends readonly [infer H, ...infer T]
	? [H] extends [never]
		? FirstOf<T>
		: H
	: never

type DeriveLeft<Tables extends readonly Table[], C extends Ctx, Back extends readonly Tk[]> = Back extends readonly [
	TokenKey<infer Op>,
	...infer B2 extends readonly Tk[],
]
	? Op extends CompareOp | ArithOp
		? OperandType<Op, ColumnOfBack<Tables, B2>> extends infer S
			? [S] extends [never]
				? never
				: S extends SqlTypeShape
					? Op extends "="
						? C["inSet"] extends true
							? S
							: NonNull<S>
						: NonNull<S>
					: never
			: never
		: Op extends "limit" | "offset"
			? SqlInteger
			: Op extends "between"
				? NonNullOf<ColumnOfBack<Tables, B2>>
				: Op extends "and"
					? B2 extends readonly [Tk, TokenKey<"between">, ...infer B3 extends readonly Tk[]]
						? NonNullOf<ColumnOfBack<Tables, B3>>
						: never
					: never
	: never

type NonNullOf<S> = [S] extends [never] ? never : S extends SqlTypeShape ? NonNull<S> : never

type DeriveRight<Tables extends readonly Table[], R extends readonly Tk[]> = R extends readonly [
	TokenKey<infer Op>,
	...infer R2 extends readonly Tk[],
]
	? Op extends CompareOp | ArithOp
		? NonNullOf<OperandType<Op, ColumnOfFront<Tables, R2>>>
		: never
	: never

type DeriveCast<Back extends readonly Tk[], R extends readonly Tk[]> = Back extends readonly [
	TokenKey<"(">,
	TokenKey<"cast">,
	...Tk[],
]
	? R extends readonly [TokenKey<"as">, ...infer R2 extends readonly Tk[]]
		? CastTarget<R2>
		: never
	: R extends readonly [TokenKey<"::">, ...infer R2 extends readonly Tk[]]
		? CastTarget<R2>
		: never

type DeriveInsert<C extends Ctx, Back extends readonly Tk[]> = C["values"] extends {
	depth: infer D extends readonly unknown[]
	pos: infer P extends readonly unknown[]
}
	? D["length"] extends 1
		? Back extends readonly [TokenKey<"(" | ",">, ...Tk[]]
			? C["insert"] extends infer Cols extends readonly SqlTypeShape[]
				? Cols[P["length"]] extends infer S
					? [S] extends [undefined]
						? never
						: S extends SqlTypeShape
							? S
							: never
					: never
				: never
			: never
		: never
	: never

type DeriveInList<C extends Ctx, Back extends readonly Tk[]> = C["inList"] extends SqlTypeShape
	? Back extends readonly [TokenKey<"(" | ",">, ...Tk[]]
		? C["inList"]
		: never
	: never

type ParamKey<T> = T extends TokenParam<infer N> ? N : T extends TokenIndexedParam<infer I> ? `$${I}` : never

/** Context after reading token `H` (`Back` is the reversed list before `H`). */
type NextCtx<Tables extends readonly Table[], C extends Ctx, H, Back extends readonly Tk[]> =
	H extends TokenKey<"set">
		? { inList: C["inList"]; inSet: true; insert: C["insert"]; values: C["values"] }
		: H extends TokenKey<"where" | "from" | "returning">
			? { inList: C["inList"]; inSet: false; insert: C["insert"]; values: C["values"] }
			: H extends TokenKey<"values">
				? { inList: C["inList"]; inSet: C["inSet"]; insert: C["insert"]; values: { depth: []; pos: [] } }
				: H extends TokenKey<"(">
					? {
							inList: Back extends readonly [TokenKey<"in">, ...infer B2 extends readonly Tk[]]
								? NonNullOf<ColumnOfBack<Tables, B2>> extends infer S
									? [S] extends [never]
										? null
										: S extends SqlTypeShape
											? S
											: null
									: null
								: C["inList"]
							inSet: C["inSet"]
							insert: C["insert"]
							values: C["values"] extends { depth: infer D extends readonly unknown[] }
								? { depth: [...D, unknown]; pos: D extends readonly [] ? [] : C["values"]["pos"] }
								: null
						}
					: H extends TokenKey<")">
						? {
								inList: null
								inSet: C["inSet"]
								insert: C["insert"]
								values: C["values"] extends {
									depth: infer D extends readonly unknown[]
									pos: infer P extends readonly unknown[]
								}
									? D extends readonly [unknown, ...infer D2 extends readonly unknown[]]
										? { depth: D2; pos: P }
										: null
									: null
							}
						: H extends TokenKey<",">
							? {
									inList: C["inList"]
									inSet: C["inSet"]
									insert: C["insert"]
									values: C["values"] extends {
										depth: infer D extends readonly unknown[]
										pos: infer P extends readonly unknown[]
									}
										? D["length"] extends 1
											? { depth: D; pos: [...P, unknown] }
											: C["values"]
										: null
								}
							: C["values"] extends { depth: readonly [] }
								? { inList: C["inList"]; inSet: C["inSet"]; insert: C["insert"]; values: null }
								: C

type Scan<
	Tables extends readonly Table[],
	Toks extends readonly Tk[],
	C extends Ctx,
	Back extends readonly Tk[],
	Map extends Record<string, SqlTypeShape>,
	Seen extends readonly string[],
> = Toks extends readonly [infer H extends Tk, ...infer R extends readonly Tk[]]
	? ParamKey<H> extends infer K extends string
		? [K] extends [never]
			? Scan<Tables, R, NextCtx<Tables, C, H, Back>, [H, ...Back], Map, Seen>
			: Scan<
					Tables,
					R,
					C,
					[H, ...Back],
					K extends keyof Map
						? Map
						: [DeriveParam<Tables, C, Back, R>] extends [never]
							? Map
							: Map & { [P in K]: DeriveParam<Tables, C, Back, R> },
					K extends Seen[number] ? Seen : [...Seen, K]
				>
		: never
	: { map: Map; seen: Seen }

/** Scanned parameters of a statement: the derived types by key (`name` or `$n`) and every key seen. */
type ScanStatement<Db extends JsqlDatabaseShape, Toks extends readonly Tk[]> = Scan<
	CollectTables<Db, Toks>,
	Toks,
	{ inList: null; inSet: false; insert: InsertColumns<Db, Toks>; values: null },
	[],
	{},
	[]
>

type DisplayKey<K extends string> = K extends `$${string}` ? K : `:${K}`

/** The first seen key that is among `Wanted` and has no derived type. */
type FirstUnderived<Map, Seen extends readonly string[], Wanted extends string> = Seen extends readonly [
	infer K extends string,
	...infer Rest extends readonly string[],
]
	? K extends Wanted
		? K extends keyof Map
			? FirstUnderived<Map, Rest, Wanted>
			: K
		: FirstUnderived<Map, Rest, Wanted>
	: never

type KeysOfValues<V> = V extends readonly unknown[]
	? number extends V["length"]
		? `$${number}`
		: { [I in keyof V & `${number}`]: `$${Inc<ParseNumber<I>>}` }[keyof V & `${number}`]
	: Extract<keyof V, string>

/** Positional parameters as a tuple `$1 … $n`. */
type PositionalTuple<
	Map,
	Seen extends readonly string[],
	Len extends number,
	Acc extends readonly SqlTypeShape[] = [],
> = (number extends Len ? false : Acc["length"] extends Len ? true : false) extends true
	? Acc
	: `$${Inc<Acc["length"]>}` extends infer K extends string
		? K extends Seen[number]
			? K extends keyof Map
				? Map[K] extends infer S extends SqlTypeShape
					? PositionalTuple<Map, Seen, Len, [...Acc, S]>
					: Acc
				: Acc
			: Acc
		: Acc

type NamedParams<Map, Values> = {
	[K in Extract<keyof Values, string> as K extends keyof Map ? K : never]: K extends keyof Map ? Map[K] : never
}

/**
 * The parameter types of `Stmt` for values `Values` (CORE-6): a record by name or a tuple by position, or the
 * CORE-7 error for a provided parameter whose type cannot be derived from its position.
 */
export type InferSqlParams<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Syntax extends string,
	Values,
> = Values extends null | undefined
	? EmptyExpressionParams
	: ScanStatement<Db, Tokenize<Stmt, Syntax>> extends {
				map: infer Map
				seen: infer Seen extends readonly string[]
		  }
		? FirstUnderived<Map, Seen, KeysOfValues<Values>> extends infer Bad extends string
			? [Bad] extends [never]
				? Values extends readonly unknown[]
					? PositionalTuple<Map, Seen, Values["length"]> extends infer Tup extends ExpressionParamsShape
						? Tup
						: never
					: NamedParams<Map, Values> extends infer Rec extends ExpressionParamsShape
						? Rec
						: never
				: FormatError<Errors["CANNOT_INFER_PARAMETER_TYPE"], [DisplayKey<Bad>, DisplayKey<Bad>]>
			: never
		: never
