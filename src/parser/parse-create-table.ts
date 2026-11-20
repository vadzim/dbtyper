import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseQualifiedTableName } from "./parse-qualified-table-name.ts"
import type { DialectFact } from "../core/dialect.ts"
import type {
	ParseSkipStatement,
	SkipBracketedUntil,
	SkipFailedExpression,
	SkipFailedStatement,
} from "./skip-statement.ts"
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

export type WithoutPendingConstraints<Db extends JsqlDatabaseShape> = Db extends { pendingConstraints: string }
	? Omit<Db, "pendingConstraints"> extends infer Clean extends JsqlDatabaseShape
		? Clean
		: Db
	: Db

export type PendingConstraints<Db extends JsqlDatabaseShape> = Db extends { pendingConstraints: infer P extends string }
	? { names: P }
	: null

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
			? ParseCreateTableOpenParenOrAs<R, Db, Sch, Tab, IfNotExists, Params>
			: IfNotExists extends true
				? // the rest of the statement is stepped over (it used to be left for the next "statement", #157)
					ParseSkipStatement<R, Db>
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
	IfNotExists extends boolean,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"as">
		? ParseCreateTableAsSelect<SkipToken<Tokens>, Db, Schema, Table, Params>
		: ParseCreateTableOpenParen<Tokens, Db, Schema, Table, IfNotExists>

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
				? JsqlDbReplaceData<
						Db,
						Schema,
						Table,
						DialectFact<Db, "rowidTables"> extends true
							? JsqlCreateRowidTable<{ [K in keyof Res["returning"]]: NullableType<Res["returning"][K]> }>
							: JsqlCreateTable<{ [K in keyof Res["returning"]]: NullableType<Res["returning"][K]> }>
					> extends infer NewDb extends JsqlDatabaseShape
					? PeekToken<R> extends TokenKey<";"> | TokenEot
						? [SkipToken<R>, NewDb, null]
						: SkipFailedStatement<R, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE TABLE"]>>
					: never
				: never
		: never

type NullableType<T> = T extends SqlTypeShape ? { type: T["type"]; arg: T["arg"]; nullable: true } : never

export type NotNullType<T extends SqlTypeShape> = NonNull<T>

type ParseCreateTableOpenParen<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	IfNotExists extends boolean,
> =
	PeekToken<Tokens> extends infer OpenTok
		? SkipToken<Tokens> extends infer AfterOpen extends ParserMonad
			? OpenTok extends TokenKey<"(">
				? IfNotExists extends true
					? JsqlDbGetData<Db, Schema, Table> extends null
						? ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
						: ParseCreateTableBodySkipOnly<AfterOpen, Db>
					: ParseCreateTableBody<AfterOpen, Db, Schema, Table, []>
				: SkipFailedExpression<
							AfterOpen,
							FormatError<Errors["EXPECTED_OPEN_PAREN_BEFORE_COLUMN_LIST_IN_CREATE_TABLE"], []>
					  > extends [infer Rest extends ParserMonad, infer Err]
					? [Rest, Db, Err]
					: never
			: never
		: never

type ParseCreateTableBodySkipOnly<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	SkipBracketedUntil<Tokens, TokenKey<";">> extends [infer AfterSemi extends ParserMonad, infer R]
		? R extends DbtyperErrorShape
			? [SkipToken<AfterSemi>, Db, R]
			: [SkipToken<AfterSemi>, Db, null]
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
