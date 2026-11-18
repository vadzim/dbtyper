import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlSchemaShape,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseQualifiedTableName } from "./parse-qualified-table-name.ts"
import type { ParseSqlType } from "./parse-sql-type-words.ts"
import type { DialectFact, SqliteStrictTypeNames } from "../core/dialect.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type {
	JsqlCreateTable,
	JsqlCreateRowidTable,
	JsqlDbReplaceColumn,
	JsqlDbGetSchema,
	JsqlDbGetData,
	JsqlDbGetTable,
	UnqualifiedSchema,
	JsqlDbReplaceData,
} from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseExpressionAST,
	ResolveExpressionAST,
	SameComparisonClass,
	ScalarExprAst,
} from "./parse-expression.ts"
import type { ParseSelectExpression } from "./parse-select.ts"
import type { FinishAlterStatement, ParseAlterActions } from "./parse-alter-table.ts"

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
type WithPendingConstraint<Db extends JsqlDatabaseShape, Name extends string> = Db extends {
	pendingConstraints: infer P extends string
}
	? Omit<Db, "pendingConstraints"> & { pendingConstraints: P | Name }
	: Db & { pendingConstraints: Name }

type WithoutPendingConstraints<Db extends JsqlDatabaseShape> = Db extends { pendingConstraints: string }
	? Omit<Db, "pendingConstraints"> extends infer Clean extends JsqlDatabaseShape
		? Clean
		: Db
	: Db

type PendingConstraints<Db extends JsqlDatabaseShape> = Db extends { pendingConstraints: infer P extends string }
	? { names: P }
	: null

/**
 * One column while it is being parsed (CORE-15): name, type (its `nullable` is the declared NULL / NOT NULL),
 * NOT NULL by any constraint (NOT NULL, PRIMARY KEY; CORE-1), has a DEFAULT, is a generated column (CORE-18).
 */
type ColumnDef = readonly [string, SqlTypeShape, boolean, boolean, boolean | "identity", PkKind, string]

/**
 * How a column is part of the PRIMARY KEY: alone (`single`: inline, or a one-column table constraint) or with others.
 * SQLite decides NOT NULL and the rowid alias from it at the end of the table (SQLT-13, SQLT-14).
 */
type PkKind = false | "single" | "composite"

/** The table options of a SQLite CREATE TABLE after `)` (SQLT-11, SQLT-14, SQLT-18). */
type TableOptions = { strict: boolean; withoutRowid: boolean }

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
				? [R, Db, null]
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

type NotNullType<T extends SqlTypeShape> = { type: T["type"]; arg: T["arg"]; nullable: false }

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
type ParseCreateTableCloseParenAndSemi<Tokens extends ParserMonad, NewDb extends JsqlDatabaseShape> =
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

type TableConstraintStart =
	| TokenKey<"constraint">
	| TokenKey<"primary">
	| TokenKey<"unique">
	| TokenKey<"check">
	| TokenKey<"foreign">

/**
 * SQLite: after the column list `)`: the table options (`STRICT`, `WITHOUT ROWID`, comma separated, SQLT-18), the
 * STRICT type check (SQLT-11), then NOT NULL of the primary key and the rowid alias per table kind (SQLT-13, SQLT-14).
 */
type ParseSqliteTableEnd<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? ParseTableOptions<R1, { strict: false; withoutRowid: false }> extends [
				infer R2 extends ParserMonad,
				infer Opts,
			]
			? Opts extends DbtyperErrorShape
				? SkipFailedStatement<R2, Db, Opts>
				: Opts extends TableOptions
					? Opts["strict"] extends true
						? StrictViolation<Stack> extends false
							? SqliteTableBuilt<R2, Db, Schema, Table, Stack, Opts>
							: SkipFailedStatement<R2, Db, FormatError<Errors["STRICT_TABLE_TYPE_NOT_ALLOWED"], []>>
						: SqliteTableBuilt<R2, Db, Schema, Table, Stack, Opts>
					: never
			: never
		: never

/** `true` when a column of a STRICT table has a declared type name that STRICT does not allow (SQLT-11). */
type StrictViolation<Stack extends readonly ColumnDef[]> = true extends {
	[I in keyof Stack]: Stack[I][6] extends "" | SqliteStrictTypeNames ? false : true
}[number]
	? true
	: false

/** `STRICT`, `WITHOUT ROWID`, in any order, comma separated; `[rest, options | error]`. */
type ParseTableOptions<Tokens extends ParserMonad, Acc extends TableOptions> =
	PeekToken<Tokens> extends TokenIdent<"strict">
		? AfterTableOption<SkipToken<Tokens>, { strict: true; withoutRowid: Acc["withoutRowid"] }>
		: PeekToken<Tokens> extends TokenIdent<"without">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenIdent<"rowid">
					? AfterTableOption<SkipToken<R1>, { strict: Acc["strict"]; withoutRowid: true }>
					: [R1, FormatError<Errors["EXPECTED_TABLE_OPTION_IN_CREATE_TABLE"], []>]
				: never
			: [Tokens, Acc]

type AfterTableOption<Tokens extends ParserMonad, Acc extends TableOptions> =
	PeekToken<Tokens> extends TokenKey<","> ? ParseTableOptions<SkipToken<Tokens>, Acc> : [Tokens, Acc]

/** SQLT-18: a WITHOUT ROWID table needs a PRIMARY KEY (a column or a table constraint). */
type SqliteTableBuilt<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Opts extends TableOptions,
> = Opts["withoutRowid"] extends true
	? true extends { [I in keyof Stack]: Stack[I][5] extends false ? false : true }[number]
		? SqliteTableBuiltOk<Tokens, Db, Schema, Table, Stack, Opts>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["WITHOUT_ROWID_NEEDS_PRIMARY_KEY"], []>>
	: SqliteTableBuiltOk<Tokens, Db, Schema, Table, Stack, Opts>

type SqliteTableBuiltOk<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Opts extends TableOptions,
> =
	ColumnsFromStack<SqlitePrimaryKeys<Stack, Opts>> extends infer M extends {
		cols: Record<string, SqlTypeShape>
		facts: Record<string, unknown>
	}
		? JsqlDbReplaceData<
				Db,
				Schema,
				Table,
				Opts["withoutRowid"] extends true
					? JsqlCreateTable<M["cols"], M["facts"]>
					: JsqlCreateRowidTable<M["cols"], M["facts"]>
			> extends infer NewDb extends JsqlDatabaseShape
			? PeekToken<Tokens> extends TokenKey<";"> | TokenEot
				? [SkipToken<Tokens>, NewDb, null]
				: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE TABLE"]>>
			: never
		: never

/**
 * SQLT-13, SQLT-14: a primary key column is NOT NULL in a STRICT or WITHOUT ROWID table, or when it is the rowid
 * (alone, declared exactly INTEGER; it is then also optional in INSERT, DML-4); else it stays as declared.
 */
type SqlitePrimaryKeys<Stack extends readonly ColumnDef[], Opts extends TableOptions> = {
	[I in keyof Stack]: Stack[I] extends readonly [
		infer N extends string,
		infer T extends SqlTypeShape,
		infer Nn extends boolean,
		infer D extends boolean,
		infer G extends boolean | "identity",
		infer Pk extends PkKind,
		infer Decl extends string,
	]
		? Pk extends false
			? Stack[I]
			: Opts["withoutRowid"] extends true
				? readonly [N, T, true, D, G, Pk, Decl]
				: Opts["strict"] extends true
					? readonly [N, T, true, D, G, Pk, Decl]
					: [Pk, Decl] extends ["single", "integer"]
						? readonly [N, T, true, true, G, Pk, Decl]
						: readonly [N, T, Nn, D, G, Pk, Decl]
		: never
}

type ParseCreateTableBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? DialectFact<Db, "rowidTables"> extends true
			? ParseSqliteTableEnd<Tokens, Db, Schema, Table, Stack>
			: ColumnsFromStack<Stack> extends infer M extends {
						cols: Record<string, SqlTypeShape>
						facts: Record<string, unknown>
				  }
				? JsqlDbReplaceData<
						WithoutPendingConstraints<Db>,
						Schema,
						Table,
						JsqlCreateTable<M["cols"], M["facts"], PendingConstraints<Db>>
					> extends infer NewDb
					? NewDb extends JsqlDatabaseShape
						? ParseCreateTableCloseParenAndSemi<Tokens, NewDb>
						: never
					: never
				: never
		: PeekToken<Tokens> extends TableConstraintStart
			? ParseTableConstraint<Tokens, Db, Schema, Table, Stack>
			: ParseOneColumn<Tokens, Db, Schema, Table, Stack>

type ParseOneColumn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer ColName extends string>
		? ColName extends Stack[number][0]
			? SkipFailedStatement<Tokens, Db, FormatError<Errors["COLUMN_ALREADY_EXISTS"], [ColName]>>
			: ParseOneColumnAfterColName<SkipToken<Tokens>, Db, Schema, Table, Stack, ColName>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in CREATE TABLE"]>>

export type ParseOneColumnAfterColName<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> =
	// SQLT-10: a SQLite column may have no type: the next token is not a type word (`ANY` is a keyword, `COLLATE` a name)
	DialectFact<Db, "typelessColumns"> extends true
		? PeekToken<AfterColName> extends TokenKey<"any">
			? ParseColumnConstraints<
					SkipToken<AfterColName>,
					{
						db: Db
						schema: Schema
						table: Table
						stack: Stack
						name: ColName
						type: AnyTypeShape
						declared: "any"
						alter: Alter
					},
					{ nn: false; def: false; gen: false; afterDefault: false; pk: false }
				>
			: PeekToken<AfterColName> extends TokenIdent<"collate">
				? ParseOneColumnTypeless<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
				: PeekToken<AfterColName> extends TokenIdent<string>
					? ParseOneColumnTyped<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
					: ParseOneColumnTypeless<AfterColName, Db, Schema, Table, Stack, ColName, Alter>
		: ParseOneColumnTyped<AfterColName, Db, Schema, Table, Stack, ColName, Alter>

/** SQLT-10: the type of a column declared without one (or as `ANY`). */
type AnyTypeShape = { type: "any"; arg: null; nullable: true }

type ParseOneColumnTypeless<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> = ParseColumnConstraints<
	AfterColName,
	{
		db: Db
		schema: Schema
		table: Table
		stack: Stack
		name: ColName
		type: AnyTypeShape
		declared: ""
		alter: Alter
	},
	{ nn: false; def: false; gen: false; afterDefault: false; pk: false }
>

type ParseOneColumnTyped<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
	Alter extends boolean = false,
> =
	ParseSqlType<AfterColName, Db, true, Schema> extends [infer AfterType extends ParserMonad, infer TypeShape]
		? TypeShape extends DbtyperErrorShape
			? [AfterType, Db, TypeShape]
			: TypeShape extends SqlTypeShape
				? ParseColumnConstraints<
						AfterType,
						{
							db: Db
							schema: Schema
							table: Table
							stack: Stack
							name: ColName
							type: { type: TypeShape["type"]; arg: TypeShape["arg"]; nullable: TypeShape["nullable"] }
							declared: TypeShape extends { declared: infer Declared extends string } ? Declared : ""
							alter: Alter
						},
						{
							nn: TypeShape["nullable"] extends false ? true : false
							def: false
							gen: false
							afterDefault: false
							pk: false
						}
					>
				: [AfterType, Db, FormatError<Errors["EXPECTED_COLUMN_TYPE_IN_CREATE_TABLE"], []>]
		: never

/** The column being parsed (see {@link ParseColumnConstraints}). */
type ColumnCtx = {
	db: JsqlDatabaseShape
	schema: string
	table: string
	stack: readonly ColumnDef[]
	name: string
	type: SqlTypeShape
	/** The declared type name, lower-case (SQLite only, see {@link DeclaredTypeName}). */
	declared: string
	/** The column is the one of `ALTER TABLE … ADD COLUMN` (SQLite, SQLT-21): the definition ends at `;`, not `)`. */
	alter: boolean
}

/** What the constraints seen so far say about the column; `afterDefault` is true right after a DEFAULT (error text). */
type ColumnState = {
	nn: boolean
	def: boolean
	/** A generated column (CORE-18), or `"identity"`: `GENERATED ALWAYS AS IDENTITY`, writable with OVERRIDING (PGT-25). */
	gen: boolean | "identity"
	afterDefault: boolean
	pk: PkKind
}

/**
 * Column constraints in any order after the type (CORE-15): NOT NULL, NULL, DEFAULT, PRIMARY KEY, UNIQUE, CHECK,
 * REFERENCES, COLLATE, GENERATED ALWAYS AS, each optionally named with CONSTRAINT. Ends at `,` or `)`.
 * Each constraint has its own parser entered AT its keyword, so a monad is never consumed twice on one path.
 */
type ParseColumnConstraints<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<",">
		? C["alter"] extends true
			? AlterColumnDone<Tokens, C, S>
			: ParseCreateTableBody<
					SkipToken<Tokens>,
					C["db"],
					C["schema"],
					C["table"],
					readonly [...C["stack"], ColumnEntry<C, S>]
				>
		: PeekToken<Tokens> extends TokenKey<")">
			? C["alter"] extends true
				? AlterColumnDone<Tokens, C, S>
				: ParseCreateTableBody<
						Tokens,
						C["db"],
						C["schema"],
						C["table"],
						readonly [...C["stack"], ColumnEntry<C, S>]
					>
			: PeekToken<Tokens> extends TokenKey<"constraint">
				? ColumnConstraintName<Tokens, C, S>
				: PeekToken<Tokens> extends TokenKey<"not">
					? ColumnNotNull<Tokens, C, S>
					: PeekToken<Tokens> extends TokenKey<"null">
						? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, { nn: false }>>
						: PeekToken<Tokens> extends TokenKey<"default">
							? ParseColumnDefault<SkipToken<Tokens>, C, S>
							: PeekToken<Tokens> extends TokenKey<"primary">
								? ColumnPrimaryKey<Tokens, C, S>
								: PeekToken<Tokens> extends TokenKey<"unique">
									? ColumnUnique<Tokens, C, S>
									: PeekToken<Tokens> extends TokenKey<"check">
										? SkipParenGroup<SkipToken<Tokens>> extends [
												infer R extends ParserMonad,
												infer E,
											]
											? ColumnAfterGroup<R, E, C, S>
											: never
										: PeekToken<Tokens> extends TokenKey<"references">
											? ParseReferences<
													SkipToken<Tokens>,
													C["db"],
													C["schema"],
													C["table"]
												> extends [infer R extends ParserMonad, infer E]
												? ColumnAfterGroup<R, E, C, S>
												: never
											: PeekToken<Tokens> extends TokenIdent<"collate">
												? ColumnCollate<Tokens, C, S>
												: PeekToken<Tokens> extends TokenKey<"generated">
													? ParseColumnGenerated<SkipToken<Tokens>, C, S>
													: PeekToken<Tokens> extends TokenIdent<"autoincrement">
														? ColumnAutoincrement<Tokens, C, S>
														: PeekToken<Tokens> extends TokenKey<"as">
															? ColumnShortGenerated<Tokens, C, S>
															: ColumnGenericFail<Tokens, C, S>

/** The error for a token that no column constraint starts with. */
type ColumnGenericFail<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenIdent<"deferrable" | "initially">
		? ColumnDeferrable<Tokens, C, S>
		: ColumnGenericFailNoDefer<Tokens, C, S>

/** PGT-18: `DEFERRABLE`, `INITIALLY DEFERRED | IMMEDIATE` change nothing the types see. */
type ColumnDeferrable<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenIdent<"initially">
		? ParseColumnConstraints<SkipToken<SkipToken<Tokens>>, C, ColumnStateWith<S, {}>>
		: ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>

type ColumnGenericFailNoDefer<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
> = C["alter"] extends true
	? PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? AlterColumnDone<Tokens, C, S>
		: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_SEMICOLON"], ["ALTER TABLE"]>>
	: PeekToken<Tokens> extends OnConflictToken<C["db"]>
		? ColumnOnConflict<Tokens, C, S>
		: ColumnFail<
				Tokens,
				C,
				S["afterDefault"] extends true
					? FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE"], []>
					: FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
			>

/** SQLite (SQLT-18): the type parser takes `NOT NULL`, so `ON CONFLICT` can follow the type; nothing else has `ON` here. */
type OnConflictToken<Db extends JsqlDatabaseShape> = DialectFact<Db, "ddl"> extends true ? TokenKey<"on"> : never

/**
 * `ALTER TABLE … ADD COLUMN <definition>` of a SQLite chain ends here (SQLT-20, SQLT-21): NOT NULL needs a default;
 * the column joins the table with the facts a CREATE TABLE gives it.
 */
type AlterColumnDone<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = S["nn"] extends true
	? [S["def"], PgAlter<C>] extends [false, never]
		? ColumnFail<
				Tokens,
				C,
				FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["NOT NULL without a non-null DEFAULT"]>
			>
		: AlterColumnStore<Tokens, C, S>
	: AlterColumnStore<Tokens, C, S>

type AlterColumnStore<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	OneCol<ColumnEntry<C, S>> extends { cols: infer Cols; facts: infer Facts }
		? AlterColumnFinish<
				Tokens,
				C,
				JsqlDbReplaceColumn<
					C["db"],
					C["schema"],
					C["table"],
					C["name"],
					{
						type: C["name"] extends keyof Cols ? Cols[C["name"]] & SqlTypeShape : SqlTypeShape
					} & (C["name"] extends keyof Facts ? Facts[C["name"]] : {})
				>
			>
		: never

/** PostgreSQL (PGT-19): `ADD COLUMN` takes the full column definition and may be followed by `, <action>`. */
type PgAlter<C extends ColumnCtx> = DialectFact<C["db"], "ddl"> extends true ? never : true

/** SQLite: the definition ends the statement (SQLT-21); PostgreSQL goes on with the next action. */
type AlterColumnFinish<Tokens extends ParserMonad, C extends ColumnCtx, Db extends JsqlDatabaseShape> =
	DialectFact<C["db"], "ddl"> extends true
		? FinishAlterStatement<Tokens, Db>
		: ParseAlterActions<Tokens, Db, C["schema"], C["table"]>

/** At `AUTOINCREMENT` (SQLite, SQLT-16): only on a column declared exactly `INTEGER PRIMARY KEY`. */
type ColumnAutoincrement<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "rowidTables"> extends true
		? S["pk"] extends "single"
			? C["declared"] extends "integer"
				? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>
				: ColumnFail<Tokens, C, FormatError<Errors["AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY"], []>>
			: ColumnFail<Tokens, C, FormatError<Errors["AUTOINCREMENT_NEEDS_INTEGER_PRIMARY_KEY"], []>>
		: ColumnGenericFail<Tokens, C, S>

/** At `CONSTRAINT`: skip it and its name. */
type ColumnConstraintName<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
			? ParseColumnConstraints<
					SkipToken<R1>,
					{
						db: WithPendingConstraint<C["db"], CName>
						schema: C["schema"]
						table: C["table"]
						stack: C["stack"]
						name: C["name"]
						type: C["type"]
						declared: C["declared"]
						alter: C["alter"]
					},
					S
				>
			: ColumnFail<R1, C, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
		: never

/** At `NOT`: `NOT NULL` after the type (CORE-15). */
type ColumnNotNull<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"null">
			? ColumnOnConflict<SkipToken<R1>, C, ColumnStateWith<S, { nn: true }>>
			: PeekToken<R1> extends TokenIdent<"deferrable">
				? ParseColumnConstraints<SkipToken<R1>, C, ColumnStateWith<S, {}>>
				: ColumnFail<R1, C, FormatError<Errors["EXPECTED_NULL_AFTER_NOT"], []>>
		: never

/** At `PRIMARY`: `PRIMARY KEY` makes the column NOT NULL (CORE-1). */
type ColumnPrimaryKey<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = [
	C["alter"],
	PgAlter<C>,
] extends [true, never]
	? ColumnFail<Tokens, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["PRIMARY KEY"]>>
	: SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"key">
			? ColumnPkTail<
					SkipToken<R1>,
					C,
					DialectFact<C["db"], "pkImpliesNotNull"> extends true
						? ColumnStateWith<S, { nn: true; pk: "single" }>
						: ColumnStateWith<S, { pk: "single" }>
				>
			: ColumnFail<R1, C, FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>>
		: never

/** At `UNIQUE`; SQLite: an `ON CONFLICT` clause may follow (SQLT-18). */
type ColumnUnique<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> = [
	C["alter"],
	PgAlter<C>,
] extends [true, never]
	? ColumnFail<Tokens, C, FormatError<Errors["SQLITE_ADD_COLUMN_RESTRICTED"], ["UNIQUE"]>>
	: ColumnOnConflict<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>

/** After `PRIMARY KEY`; SQLite: `ASC` / `DESC` and `ON CONFLICT` may follow (SQLT-18). */
type ColumnPkTail<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? PeekToken<Tokens> extends TokenKey<"desc" | "asc">
			? ColumnOnConflict<SkipToken<Tokens>, C, S>
			: ColumnOnConflict<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/** SQLite (SQLT-18): an optional `ON CONFLICT <action>` after NOT NULL, UNIQUE, PRIMARY KEY; then more constraints. */
type ColumnOnConflict<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? PeekToken<Tokens> extends TokenKey<"on">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"conflict">
					? ParseColumnConstraints<SkipToken<SkipToken<R1>>, C, S>
					: ColumnGenericFail<R1, C, S>
				: never
			: ParseColumnConstraints<Tokens, C, S>
		: ParseColumnConstraints<Tokens, C, S>

/** At `AS (expr) [STORED | VIRTUAL]`: SQLite's short form of a generated column (SQLT-18). */
type ColumnShortGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	DialectFact<C["db"], "ddl"> extends true
		? ColumnGeneratedBody<SkipToken<Tokens>, C, S>
		: ColumnGenericFail<Tokens, C, S>

/** At `COLLATE`: skip it and the collation name (quoted or not, possibly qualified). */
type ColumnCollate<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? PeekToken<R2> extends TokenKey<".">
				? SkipToken<R2> extends infer R3 extends ParserMonad
					? ParseColumnConstraints<SkipToken<R3>, C, ColumnStateWith<S, {}>>
					: never
				: ParseColumnConstraints<R2, C, ColumnStateWith<S, {}>>
			: never
		: never

/** `S` with some fields replaced; `afterDefault` is reset unless the patch sets it. */
type ColumnStateWith<S extends ColumnState, Patch extends Partial<ColumnState>> = {
	nn: Patch extends { nn: infer V extends boolean } ? V : S["nn"]
	def: Patch extends { def: infer V extends boolean } ? V : S["def"]
	gen: Patch extends { gen: infer V extends boolean | "identity" } ? V : S["gen"]
	afterDefault: Patch extends { afterDefault: infer V extends boolean } ? V : false
	pk: Patch extends { pk: infer V extends PkKind } ? V : S["pk"]
}

type ColumnEntry<C extends ColumnCtx, S extends ColumnState> = readonly [
	C["name"],
	C["type"],
	S["nn"],
	S["def"],
	S["gen"],
	S["pk"],
	C["declared"],
]

type ColumnFail<Tokens extends ParserMonad, C extends ColumnCtx, Err extends DbtyperErrorShape> = SkipFailedStatement<
	Tokens,
	C["db"],
	Err
>

/** `[rest, null | error]` after a bracketed group `( … )` (the `(` is the next token). */
type SkipParenGroup<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<")">> extends [infer R extends ParserMonad, infer Res]
			? Res extends DbtyperErrorShape
				? SkipFailedExpression<R, Res>
				: [SkipToken<R>, null]
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT"], []>>

/** After a constraint helper `[rest, null | error]`: go on with the column or fail the statement. */
type ColumnAfterGroup<
	R extends ParserMonad,
	E,
	C extends ColumnCtx,
	S extends ColumnState,
> = E extends DbtyperErrorShape ? [R, C["db"], E] : ParseColumnConstraints<R, C, ColumnStateWith<S, {}>>

/**
 * After `GENERATED`: `ALWAYS AS (expr) [STORED | VIRTUAL]` (CORE-15, CORE-18), or an identity column
 * `ALWAYS | BY DEFAULT AS IDENTITY [(options)]` (PGT-18); the expressions and options are not typed.
 */
type ParseColumnGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<"always">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"as">
				? ColumnGeneratedOrIdentity<SkipToken<R1>, C, S, true>
				: ColumnFail<R1, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>
			: never
		: PeekToken<Tokens> extends TokenKey<"by">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"default">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"as">
							? ColumnGeneratedOrIdentity<SkipToken<R2>, C, S, false>
							: ColumnFail<R2, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>
						: never
					: ColumnFail<R1, C, FormatError<Errors["EXPECTED_ALWAYS_AFTER_GENERATED"], []>>
				: never
			: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_ALWAYS_AFTER_GENERATED"], []>>

/** `[(sequence options)]` after IDENTITY: `[rest, null | error]`. */
type IdentityOptions<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"("> ? SkipParenGroup<Tokens> : [Tokens, null]

/** After `GENERATED … AS`: `IDENTITY [(options)]` (NOT NULL; ALWAYS is not insertable, BY DEFAULT is optional) or `(expr)`. */
type ColumnGeneratedOrIdentity<
	Tokens extends ParserMonad,
	C extends ColumnCtx,
	S extends ColumnState,
	Always extends boolean,
> =
	PeekToken<Tokens> extends TokenIdent<"identity">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? IdentityOptions<R1> extends [infer R2 extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? [R2, C["db"], E]
					: ParseColumnConstraints<
							R2,
							C,
							ColumnStateWith<
								S,
								Always extends true ? { nn: true; gen: "identity" } : { nn: true; def: true }
							>
						>
				: never
			: never
		: Always extends true
			? ColumnGeneratedBody<Tokens, C, S>
			: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>

/** `(expr) [STORED | VIRTUAL]` after `AS`. */
type ColumnGeneratedBody<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	SkipParenGroup<Tokens> extends [infer R2 extends ParserMonad, infer E]
		? E extends DbtyperErrorShape
			? [R2, C["db"], E]
			: PeekToken<R2> extends TokenKey<"stored" | "virtual">
				? ParseColumnConstraints<SkipToken<R2>, C, ColumnStateWith<S, { gen: true }>>
				: ParseColumnConstraints<R2, C, ColumnStateWith<S, { gen: true }>>
		: never

/**
 * After `DEFAULT`: the expression is typed like an INSERT value (DML-16) and must fit the column (CORE-15, CORE-16).
 * An unknown function is not checked: function catalogs are the dialects' (PGT-18, SQLT-19).
 */
type ParseColumnDefault<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<"," | ")" | ";"> | TokenEot
		? ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_DEFAULT_VALUE"], []>>
		: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
			? DefaultFits<DateTimeKeywordType<PeekToken<Tokens>["value"], C["db"]>, C> extends infer Err
				? Err extends DbtyperErrorShape
					? ColumnFail<SkipToken<Tokens>, C, Err>
					: ParseColumnConstraints<
							SkipToken<Tokens>,
							C,
							ColumnStateWith<S, { def: true; afterDefault: true }>
						>
				: never
			: ParseExpressionAST<
						Tokens,
						{ db: C["db"]; params: EmptyExpressionParams; outerScope: {}; noPostfixNot: true }
				  > extends [infer R extends ParserMonad, infer Ast, infer _Env]
				? Ast extends DbtyperErrorShape
					? ColumnFail<R, C, Ast>
					: Ast extends ScalarExprAst
						? DefaultFits<
								ResolveExpressionAST<Ast, C["db"], {}, EmptyExpressionParams>,
								C
							> extends infer Err
							? Err extends DbtyperErrorShape
								? ColumnFail<R, C, DefaultSyntaxError<Ast, Err>>
								: ParseColumnConstraints<R, C, ColumnStateWith<S, { def: true; afterDefault: true }>>
							: never
						: never
				: never

/** The type of `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` (the expression parser has no such keywords). */
type DateTimeKeywordType<K extends string, Db extends JsqlDatabaseShape> = {
	// SQLite (SQLT-19): the CURRENT_* values are text, and any column may default to them
	type: DialectFact<Db, "ddl"> extends true
		? "any"
		: K extends "current_date"
			? "date"
			: K extends "current_time"
				? "time"
				: "timestamp"
	arg: null
	nullable: false
}

/**
 * A column name inside a function call of a DEFAULT (`now( invalid)`) keeps its old error (SCHEMA-15):
 * a DEFAULT has no columns in scope, so an unknown name in a call is a broken call.
 */
type DefaultSyntaxError<Ast, Err extends DbtyperErrorShape> = Err extends { __sql_parser_error_code__: 2300 }
	? Ast extends { kind: "function_call" }
		? FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT"], []>
		: Err
	: Err

/** `null` when the resolved DEFAULT expression fits the column, else the error. */
type DefaultFits<V, C extends ColumnCtx> = V extends { __sql_parser_error_code__: 3619 }
	? null
	: V extends DbtyperErrorShape
		? V
		: V extends SqlTypeShape
			? V["type"] extends "null"
				? null
				: SameComparisonClass<V, C["type"]> extends true
					? null
					: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [C["name"]]>
			: never

/**
 * `REFERENCES [schema.]table [(column, …)] [MATCH …] [ON DELETE|UPDATE action …]` after the keyword (CORE-15).
 * The target must exist at this point of the chain, or be the table being created (CORE-17).
 * Result: `[rest, null]` or `[rest, error]`.
 */
type ParseReferences<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer A extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<".">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? AsIdent<PeekToken<R2>> extends TokenIdent<infer B extends string>
						? ReferencesTarget<SkipToken<R2>, Db, Schema, Table, A, B>
						: SkipFailedExpression<
								R2,
								FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in REFERENCES"]>
							>
					: never
				: ReferencesTarget<R1, Db, Schema, Table, UnqualifiedSchema<Db, A>, A>
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_TABLE_NAME"], ["in REFERENCES"]>>

type ReferencesTarget<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	TSch extends string,
	TTab extends string,
> = [TSch, TTab] extends [Schema, Table]
	? ReferencesColumns<Tokens, Record<string, SqlTypeShape>, true>
	: JsqlDbGetSchema<Db, TSch> extends JsqlSchemaShape
		? JsqlDbGetTable<Db, TSch, TTab> extends infer T extends JsqlDataShape<"table">
			? ReferencesColumns<Tokens, T["columns"], false>
			: SkipFailedExpression<Tokens, FormatError<Errors["UNKNOWN_TABLE"], [TTab, "REFERENCES"]>>
		: SkipFailedExpression<Tokens, FormatError<Errors["UNKNOWN_SCHEMA"], [TSch, "REFERENCES"]>>

/** Optional `(col, …)` of the target (each must exist unless the target is the table itself), then the actions. */
type ReferencesColumns<
	Tokens extends ParserMonad,
	Columns extends Record<string, SqlTypeShape>,
	AnyColumn extends boolean,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseNameList<SkipToken<Tokens>, readonly []> extends [infer R extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R, Names]
				: Names extends readonly string[]
					? AnyColumn extends true
						? SkipReferenceActions<R>
						: Exclude<Names[number], keyof Columns> extends infer Missing extends string
							? [Missing] extends [never]
								? SkipReferenceActions<R>
								: SkipFailedExpression<
										R,
										FormatError<Errors["UNKNOWN_COLUMN"], [Missing, "REFERENCES"]>
									>
							: never
					: never
			: never
		: SkipReferenceActions<Tokens>

/** `ON DELETE|UPDATE action`, `MATCH x`, in any number and order. Result `[rest, null]`. */
type SkipReferenceActions<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"on">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? SkipToken<R1> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"set">
					? ReferenceSetAction<SkipToken<R2>>
					: PeekToken<R2> extends TokenIdent<"no">
						? SkipToken<R2> extends infer R3 extends ParserMonad
							? SkipReferenceActions<SkipToken<R3>>
							: never
						: SkipReferenceActions<SkipToken<R2>>
				: never
			: never
		: PeekToken<Tokens> extends TokenIdent<"match">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? SkipReferenceActions<SkipToken<R1>>
				: never
			: [Tokens, null]

/** At the `NULL` or `DEFAULT` after `SET`: skip it, an optional column list, then the rest of the actions. */
type ReferenceSetAction<Tokens extends ParserMonad> =
	SkipToken<Tokens> extends infer R extends ParserMonad
		? PeekToken<R> extends TokenKey<"(">
			? SkipParenGroup<R> extends [infer R2 extends ParserMonad, infer _E]
				? SkipReferenceActions<R2>
				: never
			: SkipReferenceActions<R>
		: never

/** `a, b, c)` after `(`: `[rest after ")", names]` or `[rest, error]`. */
export type ParseNameList<Tokens extends ParserMonad, Acc extends readonly string[]> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer N extends string>
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<",">
				? ParseNameList<SkipToken<R1>, readonly [...Acc, N]>
				: PeekToken<R1> extends TokenKey<")">
					? [SkipToken<R1>, readonly [...Acc, N]]
					: SkipFailedExpression<
							R1,
							FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
						>
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in CREATE TABLE constraint"]>>

/**
 * A table constraint (CORE-15), named or not: `PRIMARY KEY (cols)` makes its columns NOT NULL (CORE-1);
 * `UNIQUE (cols)`, `CHECK (…)`, `FOREIGN KEY (cols) REFERENCES …` change no type. Columns must already be declared.
 */
type ParseTableConstraint<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<"constraint">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
				? TableConstraintBody<SkipToken<R1>, WithPendingConstraint<Db, CName>, Schema, Table, Stack>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
			: never
		: TableConstraintBody<Tokens, Db, Schema, Table, Stack>

type TableConstraintBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<"primary" | "foreign">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"key">
				? TableConstraintColumns<
						SkipToken<R1>,
						Db,
						Schema,
						Table,
						Stack,
						PeekToken<Tokens> extends TokenKey<"primary"> ? "PRIMARY KEY" : "FOREIGN KEY"
					>
				: SkipFailedStatement<
						R1,
						Db,
						FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>
					>
			: never
		: PeekToken<Tokens> extends TokenKey<"unique">
			? TableConstraintColumns<SkipToken<Tokens>, Db, Schema, Table, Stack, "UNIQUE">
			: PeekToken<Tokens> extends TokenKey<"check">
				? SkipParenGroup<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
					? E extends DbtyperErrorShape
						? [R, Db, E]
						: AfterTableConstraint<R, Db, Schema, Table, Stack>
					: never
				: SkipFailedStatement<
						Tokens,
						Db,
						FormatError<Errors["EXPECTED_CONSTRAINT_AFTER_NAME_IN_CREATE_TABLE"], []>
					>

type TableConstraintColumns<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Kind extends string,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseNameList<SkipToken<Tokens>, readonly []> extends [infer R extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R, Db, Names]
				: Names extends readonly string[]
					? Exclude<Names[number], Stack[number][0]> extends infer Missing extends string
						? [Missing] extends [never]
							? TableConstraintAfterColumns<
									R,
									Db,
									Schema,
									Table,
									Stack,
									Kind,
									Names[number],
									Names["length"] extends 1 ? true : false
								>
							: SkipFailedStatement<R, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Missing, Kind]>>
						: never
					: never
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT"], []>>

/** After the column list: a FOREIGN KEY needs REFERENCES; a PRIMARY KEY marks its columns NOT NULL (CORE-1). */
type TableConstraintAfterColumns<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	Kind extends string,
	Names extends string,
	Single extends boolean,
> = Kind extends "FOREIGN KEY"
	? PeekToken<Tokens> extends TokenKey<"references">
		? ParseReferences<SkipToken<Tokens>, Db, Schema, Table> extends [infer R2 extends ParserMonad, infer E]
			? E extends DbtyperErrorShape
				? [R2, Db, E]
				: AfterTableConstraint<R2, Db, Schema, Table, Stack>
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_REFERENCES_AFTER_FOREIGN_KEY"], []>>
	: AfterTableConstraint<
			Tokens,
			Db,
			Schema,
			Table,
			Kind extends "PRIMARY KEY" ? MarkNotNull<Stack, Names, DialectFact<Db, "pkImpliesNotNull">, Single> : Stack
		>

type AfterTableConstraint<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseCreateTableBody<SkipToken<Tokens>, Db, Schema, Table, Stack>
		: PeekToken<Tokens> extends TokenKey<")">
			? ParseCreateTableBody<Tokens, Db, Schema, Table, Stack>
			: PeekToken<Tokens> extends TokenIdent<"deferrable" | "initially"> | TokenKey<"not">
				? // PGT-18: `[NOT] DEFERRABLE`, `INITIALLY DEFERRED | IMMEDIATE` change nothing the types see
					TableConstraintDeferrable<Tokens, Db, Schema, Table, Stack>
				: PeekToken<Tokens> extends TokenKey<"on">
					? // SQLite (SQLT-18): `ON CONFLICT <action>` after a table constraint
						DialectFact<Db, "ddl"> extends true
						? AfterTableConstraint<SkipToken<SkipToken<SkipToken<Tokens>>>, Db, Schema, Table, Stack>
						: SkipFailedStatement<
								Tokens,
								Db,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
							>
					: SkipFailedStatement<
							Tokens,
							Db,
							FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
						>

type TableConstraintDeferrable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<Tokens> extends TokenIdent<"initially">
			? AfterTableConstraint<SkipToken<R1>, Db, Schema, Table, Stack>
			: AfterTableConstraint<R1, Db, Schema, Table, Stack>
		: never

type MarkNotNull<
	Stack extends readonly ColumnDef[],
	Names extends string,
	Implies extends boolean,
	Single extends boolean,
> = {
	[I in keyof Stack]: Stack[I] extends readonly [
		infer N extends string,
		infer T extends SqlTypeShape,
		infer Nn extends boolean,
		infer D extends boolean,
		infer G extends boolean | "identity",
		infer _Pk extends PkKind,
		infer Decl extends string,
	]
		? N extends Names
			? readonly [
					N,
					T,
					Implies extends true ? true : Nn,
					D,
					G,
					Single extends true ? "single" : "composite",
					Decl,
				]
			: Stack[I]
		: never
}

type ColPair = { cols: Record<string, SqlTypeShape>; facts: Record<string, unknown> }

type OneCol<C extends ColumnDef> = C extends readonly [
	infer N extends string,
	infer Sql extends SqlTypeShape,
	infer NotNull extends boolean,
	infer HasDefault extends boolean,
	infer Generated extends boolean | "identity",
	infer _Pk extends PkKind,
	infer _Decl extends string,
]
	? {
			cols: Record<N, NotNull extends true ? (Sql["nullable"] extends false ? Sql : NotNullType<Sql>) : Sql>
			facts: Generated extends "identity"
				? Record<N, { nullability: "not_null"; generated: true; identity: true }>
				: Generated extends true
					? NotNull extends true
						? Record<N, { nullability: "not_null"; generated: true }>
						: Record<N, { generated: true }>
					: NotNull extends true
						? HasDefault extends true
							? Record<N, { nullability: "not_null"; default: true }>
							: Record<N, { nullability: "not_null" }>
						: HasDefault extends true
							? Record<N, { default: true }>
							: {}
		}
	: never

type MergeRecords<A extends Record<string, unknown>, B extends Record<string, unknown>> = {
	[K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never
}

type MergeColPair<A extends ColPair, B extends ColPair> = {
	cols: MergeRecords<A["cols"], B["cols"]>
	facts: MergeRecords<A["facts"], B["facts"]>
}

/** Batched merge (chunks of 4) to keep conditional-type depth bounded on wide tables. */
type ColumnsFromStack<S extends readonly ColumnDef[]> = S extends readonly []
	? { cols: {}; facts: {} }
	: S extends readonly [infer C0 extends ColumnDef]
		? OneCol<C0>
		: S extends readonly [infer C0 extends ColumnDef, infer C1 extends ColumnDef]
			? MergeColPair<OneCol<C0>, OneCol<C1>>
			: S extends readonly [infer C0 extends ColumnDef, infer C1 extends ColumnDef, infer C2 extends ColumnDef]
				? MergeColPair<OneCol<C0>, MergeColPair<OneCol<C1>, OneCol<C2>>>
				: S extends readonly [
							infer C0 extends ColumnDef,
							infer C1 extends ColumnDef,
							infer C2 extends ColumnDef,
							infer C3 extends ColumnDef,
							...infer Rest extends readonly ColumnDef[],
					  ]
					? Rest extends readonly []
						? MergeColPair<MergeColPair<OneCol<C0>, OneCol<C1>>, MergeColPair<OneCol<C2>, OneCol<C3>>>
						: MergeColPair<
								MergeColPair<
									MergeColPair<OneCol<C0>, OneCol<C1>>,
									MergeColPair<OneCol<C2>, OneCol<C3>>
								>,
								ColumnsFromStack<Rest>
							>
					: { cols: {}; facts: {} }
