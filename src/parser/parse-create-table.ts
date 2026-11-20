import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { FoldAsciiCase } from "../lexer/sql-lexer-chars.ts"
import type { AsIdent, TokenIdent, TokenString } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseQualifiedTableName } from "./parse-qualified-table-name.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type {
	JsqlCreateTable,
	JsqlCreateRowidTable,
	JsqlDbGetSchema,
	JsqlDbGetData,
	JsqlDbReplaceData,
} from "../core/jsql-utils.ts"
import type { SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseSelectExpression } from "./parse-select.ts"
import type { ParseCreateTableBody } from "./parse-create-table-columns.ts"
import type { UnionToStringTuple } from "./set-operation-types.ts"

export type ParseCreateTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Temp extends boolean = false,
> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends ParserMonad
					? PeekToken<A1> extends TokenKey<"exists">
						? ParseCreateTableQualified<SkipToken<A1>, Db, true, Params, Temp>
						: SkipFailedExpression<
									A1,
									FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE"], []>
							  > extends [infer Rest extends ParserMonad, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE"], []>>
			: never
		: ParseCreateTableQualified<Tokens, Db, false, Params, Temp>

/**
 * PGT-25: the names given with `CONSTRAINT name` while a CREATE TABLE is parsed travel in the database state
 * (`pendingConstraints`) and end up in the table's `constraints` (`{ names }`), where `ON CONFLICT ON CONSTRAINT`
 * looks for them. Default names (`t_pkey`, `t_col_key`) are not recorded: see `ConstraintExists` (parse-insert.ts).
 */
export type WithPendingConstraint<Db extends JsqlDatabaseShape, Name extends string> = Db extends {
	pendingConstraints: infer P extends string
}
	? Omit<Db, "pendingConstraints"> & { pendingConstraints: P | Name }
	: Db & { pendingConstraints: Name }

export type PendingConstraints<Db extends JsqlDatabaseShape> = Db extends { pendingConstraints: infer P extends string }
	? { names: P }
	: null

/**
 * The name token of a column definition (CREATE TABLE, ADD COLUMN) as an identifier: a name or non-reserved keyword
 * (`AsIdent`), and where the dialect has `stringColumnNames` (SQLite, #195) a single-quoted string, folded like a
 * quoted name (SQLT-27) and keeping its spelling. Anything else is returned as is (not a name).
 */
export type ColumnNameToken<Tok, Db> =
	Tok extends TokenString<infer V extends string>
		? Tok extends { blob: true }
			? Tok
			: DialectFact<Db, "stringColumnNames"> extends true
				? FoldAsciiCase<V> extends V
					? TokenIdent<V>
					: TokenIdent<FoldAsciiCase<V>> & { written: V }
				: Tok
		: AsIdent<Tok>

/**
 * SQLT-28, #151: the declared spelling of a column whose name token was written in another case (SQLite keeps it as
 * `written`, see the lexer) travels in the database state like `pendingConstraints`, and ends in the table's `spelled`.
 */
export type WithColumnSpelling<Db extends JsqlDatabaseShape, Name extends string, Tok> = Tok extends {
	written: infer W extends string
}
	? Db extends { pendingSpelled: infer P }
		? Omit<Db, "pendingSpelled"> & { pendingSpelled: P & Record<Name, W> }
		: Db & { pendingSpelled: Record<Name, W> }
	: Db

/** The spellings collected for the columns `Names` of the table being created (`{}` when none). */
export type PendingSpelled<Db extends JsqlDatabaseShape, Names extends string> = Db extends {
	pendingSpelled: infer P
}
	? { [K in keyof P & Names]: P[K] }
	: {}

/** The database state without the pending CREATE TABLE facts. */
export type WithoutPending<Db extends JsqlDatabaseShape> = Db extends
	{ pendingConstraints: string } | { pendingSpelled: unknown } | { pendingPkName: string }
	? Omit<Db, "pendingConstraints" | "pendingSpelled" | "pendingPkName"> extends infer Clean extends JsqlDatabaseShape
		? Clean
		: Db
	: Db

/** A column of the stack is (part of) the PRIMARY KEY already: a second one is error 1519 in both engines. */
export type HasPrimaryKey<Stack extends readonly ColumnDef[], Pk extends PkKind = false> = [
	Exclude<Stack[number][5] | Pk, false>,
] extends [never]
	? false
	: true

/** The PRIMARY KEY columns of a finished column stack (CORE-15, SEL-27), `never` when it has none. */
export type StackPrimaryKey<Stack extends readonly ColumnDef[], Acc extends string = never> = Stack extends readonly [
	infer H extends ColumnDef,
	...infer R extends readonly ColumnDef[],
]
	? StackPrimaryKey<R, H[5] extends false ? Acc : Acc | H[0]>
	: Acc

/**
 * The PRIMARY KEY's constraint name: a named table constraint's, else PostgreSQL's default `<table>_pkey` (an inline
 * `CONSTRAINT n PRIMARY KEY` keeps the default).
 */
export type PendingPkName<Db extends JsqlDatabaseShape, Table extends string> = Db extends {
	pendingPkName: infer N extends string
}
	? N
	: `${Table}_pkey`

/** The error of a second PRIMARY KEY in one CREATE TABLE. */
export type MultiplePrimaryKeys<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Table extends string,
> = SkipFailedStatement<Tokens, Db, FormatError<Errors["MULTIPLE_PRIMARY_KEYS"], [Table]>>

/** The column names of a column stack in declaration order (#150). */
export type StackOrder<
	Stack extends readonly ColumnDef[],
	Acc extends readonly string[] = [],
> = Stack extends readonly [infer H extends ColumnDef, ...infer R extends readonly ColumnDef[]]
	? StackOrder<R, [...Acc, H[0]]>
	: Acc

/**
 * One column while it is being parsed (CORE-15): name, type (its `nullable` is the declared NULL / NOT NULL),
 * NOT NULL by any constraint (NOT NULL, PRIMARY KEY; CORE-1), has a DEFAULT, is a generated column (CORE-18).
 */
export type ColumnDef = readonly [string, SqlTypeShape, boolean, boolean, boolean | "identity", PkKind, string]

/**
 * How a column is part of the PRIMARY KEY: alone (`single`: inline, or a one-column table constraint) or with others.
 * SQLite decides NOT NULL and the rowid alias from it at the end of the table (SQLT-13, SQLT-14).
 */
export type PkKind = false | "single" | "composite"

/** The table options of a SQLite CREATE TABLE after `)` (SQLT-11, SQLT-14, SQLT-18). */
export type TableOptions = { strict: boolean; withoutRowid: boolean }

type ParseCreateTableQualifiedWhenSchKnown<
	R extends ParserMonad,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends keyof Db["schemas"] & string,
	Tab extends string,
	Params extends ExpressionParamsShape,
> =
	JsqlDbGetData<Db, Sch, Tab> extends infer Entry
		? Entry extends null
			? ParseCreateTableOpenParenOrAs<R, Db, Sch, Tab, Params>
			: IfNotExists extends true
				? // #172: the statement is still read and checked (as if the table were new), and the schema is kept
					ParseCreateTableOpenParenOrAs<R, JsqlDbReplaceData<Db, Sch, Tab, null>, Sch, Tab, Params> extends [
						infer R2 extends ParserMonad,
						unknown,
						infer Err,
					]
					? [R2, Db, Err]
					: never
				: SkipFailedStatement<R, Db, FormatError<Errors["TABLE_ALREADY_EXISTS_USE_IF_NOT_EXISTS"], []>>
		: never

type ParseCreateTableQualifiedWhenNameOk<
	R extends ParserMonad,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Sch extends string,
	Tab extends string,
	Params extends ExpressionParamsShape,
> =
	JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
		? Sch extends keyof Db["schemas"]
			? ParseCreateTableQualifiedWhenSchKnown<R, Db, IfNotExists, Sch & keyof Db["schemas"] & string, Tab, Params>
			: never
		: SkipFailedStatement<R, Db, FormatError<Errors["UNKNOWN_SCHEMA"], [Sch, "CREATE TABLE"]>>

type ParseCreateTableQualified<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	IfNotExists extends boolean,
	Params extends ExpressionParamsShape,
	Temp extends boolean,
> =
	ParseQualifiedTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? ParseCreateTableQualifiedWhenNameOk<R, Db, IfNotExists, Temp extends true ? "temp" : Sch, Tab, Params>
			: [R, Db, E extends DbtyperErrorShape ? E : FormatError<Errors["INVALID_CREATE_TABLE_NAME_PARSE"], []>]
		: never

type ParseCreateTableOpenParenOrAs<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"as">
		? ParseCreateTableAsSelect<SkipToken<Tokens>, Db, Schema, Table, Params>
		: ParseCreateTableOpenParen<Tokens, Db, Schema, Table>

/** `CREATE TABLE name AS SELECT …` (CORE-19): the columns are the SELECT's output columns, all nullable. */
type ParseCreateTableAsSelect<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenIdent<"with">
		? ParseCreateTableAsSelectRun<Tokens, Db, Schema, Table, Params>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseCreateTableAsSelectRun<SkipToken<Tokens>, Db, Schema, Table, Params>
			: SkipFailedStatement<
					Tokens,
					Db,
					FormatError<Errors["EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_TABLE"], []>
				>

type ParseCreateTableAsSelectRun<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Params extends ExpressionParamsShape,
> =
	ParseSelectExpression<Tokens, Db, Params> extends [infer R extends ParserMonad, infer _Db2, infer Res]
		? Res extends DbtyperErrorShape
			? [R, Db, Res]
			: Res extends JsqlSelectStatementResult
				? JsqlDbReplaceData<Db, Schema, Table, CreateTableAsShape<Db, Res>> extends infer NewDb extends
						JsqlDatabaseShape
					? PeekToken<R> extends TokenKey<";"> | TokenEot
						? [SkipToken<R>, NewDb, null]
						: SkipFailedStatement<R, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE TABLE"]>>
					: never
				: never
		: never

/**
 * CORE-19: the table of `CREATE TABLE … AS SELECT`: the output columns (all nullable) in output order (#150). Where names
 * match case-insensitively (SQLite, fact `foldQuoted`), the keys are lower-cased and the output names kept as the
 * declared spellings (SQLT-28), as for a column of CREATE TABLE.
 */
type CreateTableAsShape<Db extends JsqlDatabaseShape, Res extends JsqlSelectStatementResult> = (
	Res extends { order: infer O extends readonly string[] } ? O : UnionToStringTuple<keyof Res["returning"] & string>
) extends infer Order extends readonly string[]
	? DialectFact<Db, "lexer">["foldQuoted"] extends true
		? JsqlCreateRowidTable<
				{ [K in keyof Res["returning"] as FoldAsciiCase<K & string>]: NullableType<Res["returning"][K]> },
				null,
				never,
				LowercaseNames<Order>,
				{ [K in keyof Res["returning"] & string as FoldAsciiCase<K> extends K ? never : FoldAsciiCase<K>]: K }
			>
		: JsqlCreateTable<{ [K in keyof Res["returning"]]: NullableType<Res["returning"][K]> }, null, null, Order>
	: never

type LowercaseNames<Names extends readonly string[], Acc extends readonly string[] = []> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? LowercaseNames<R, [...Acc, FoldAsciiCase<H>]>
	: Acc

type NullableType<T> = T extends SqlTypeShape ? { type: T["type"]; arg: T["arg"]; nullable: true } : never

export type NotNullType<T extends SqlTypeShape> = NonNull<T>

type ParseCreateTableOpenParen<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends ParserMonad
			? OpenTok extends TokenKey<"(">
				? ParseCreateTableBody<AfterOpen, WithoutPending<Db>, Schema, Table, []>
				: SkipFailedExpression<
							AfterOpen,
							FormatError<Errors["EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE"], []>
					  > extends [infer Rest extends ParserMonad, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: never

/** After `)`, read `;` or end. */
export type ParseCreateTableCloseParenAndSemi<Tokens extends ParserMonad, NewDb extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends infer Tok1
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok1 extends TokenKey<")">
				? PeekToken<R1> extends infer Tok2
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? Tok2 extends TokenKey<";"> | TokenEot
							? [R2, NewDb, null]
							: SkipFailedStatement<
									R2,
									NewDb,
									FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE TABLE"]>
								>
						: never
					: never
				: SkipFailedStatement<
						R1,
						NewDb,
						FormatError<Errors["EXPECTED_CLOSE_PAREN_BEFORE_END_OF_CREATE_TABLE"], []>
					>
			: never
		: never
