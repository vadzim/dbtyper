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
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type {
	JsqlCreateTable,
	JsqlDbGetSchema,
	JsqlDbGetData,
	JsqlDbGetTable,
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

export type ParseCreateTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"if">
		? SkipToken<Tokens> extends infer A0 extends ParserMonad
			? PeekToken<A0> extends TokenKey<"not">
				? SkipToken<A0> extends infer A1 extends ParserMonad
					? PeekToken<A1> extends TokenKey<"exists">
						? ParseCreateTableQualified<SkipToken<A1>, Db, true, Params>
						: SkipFailedExpression<
									A1,
									FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_TABLE"], []>
							  > extends [infer Rest extends ParserMonad, infer Err]
							? [Rest, Db, Err]
							: never
					: never
				: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_NOT_AFTER_IF_IN_CREATE_TABLE"], []>>
			: never
		: ParseCreateTableQualified<Tokens, Db, false, Params>

/**
 * One column while it is being parsed (CORE-15): name, type (its `nullable` is the declared NULL / NOT NULL),
 * NOT NULL by any constraint (NOT NULL, PRIMARY KEY; CORE-1), has a DEFAULT, is a generated column (CORE-18).
 */
type ColumnDef = readonly [string, SqlTypeShape, boolean, boolean, boolean]

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
> =
	ParseQualifiedTableName<Tokens, Db> extends [
		infer R extends ParserMonad,
		infer E,
		infer Sch extends string,
		infer Tab extends string,
	]
		? E extends null
			? ParseCreateTableQualifiedWhenNameOk<R, Db, IfNotExists, Sch, Tab, Params>
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
						JsqlCreateTable<{ [K in keyof Res["returning"]]: NullableType<Res["returning"][K]> }>
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

type ParseCreateTableBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? ColumnsFromStack<Stack> extends infer M extends {
				cols: Record<string, SqlTypeShape>
				facts: Record<string, unknown>
			}
			? JsqlDbReplaceData<Db, Schema, Table, JsqlCreateTable<M["cols"], M["facts"]>> extends infer NewDb
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

type ParseOneColumnAfterColName<
	AfterColName extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
	ColName extends string,
> =
	ParseSqlType<AfterColName> extends [infer AfterType extends ParserMonad, infer TypeShape]
		? TypeShape extends DbtyperErrorShape
			? [AfterType, Db, TypeShape]
			: TypeShape extends SqlTypeShape
				? ParseColumnConstraints<
						AfterType,
						{ db: Db; schema: Schema; table: Table; stack: Stack; name: ColName; type: TypeShape },
						{
							nn: TypeShape["nullable"] extends false ? true : false
							def: false
							gen: false
							afterDefault: false
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
}

/** What the constraints seen so far say about the column; `afterDefault` is true right after a DEFAULT (error text). */
type ColumnState = { nn: boolean; def: boolean; gen: boolean; afterDefault: boolean }

/**
 * Column constraints in any order after the type (CORE-15): NOT NULL, NULL, DEFAULT, PRIMARY KEY, UNIQUE, CHECK,
 * REFERENCES, COLLATE, GENERATED ALWAYS AS, each optionally named with CONSTRAINT. Ends at `,` or `)`.
 */
type ParseColumnConstraints<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseCreateTableBody<
				SkipToken<Tokens>,
				C["db"],
				C["schema"],
				C["table"],
				readonly [...C["stack"], ColumnEntry<C, S>]
			>
		: PeekToken<Tokens> extends TokenKey<")">
			? ParseCreateTableBody<
					Tokens,
					C["db"],
					C["schema"],
					C["table"],
					readonly [...C["stack"], ColumnEntry<C, S>]
				>
			: PeekToken<Tokens> extends TokenKey<"constraint">
				? AsIdent<PeekToken<SkipToken<Tokens>>> extends TokenIdent<string>
					? ParseColumnConstraints<SkipToken<SkipToken<Tokens>>, C, S>
					: ColumnFail<
							SkipToken<Tokens>,
							C,
							FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>
						>
				: PeekToken<Tokens> extends TokenKey<"not">
					? PeekToken<SkipToken<Tokens>> extends TokenKey<"null">
						? ParseColumnConstraints<SkipToken<SkipToken<Tokens>>, C, ColumnStateWith<S, { nn: true }>>
						: ColumnFail<SkipToken<Tokens>, C, FormatError<Errors["EXPECTED_NULL_AFTER_NOT"], []>>
					: PeekToken<Tokens> extends TokenKey<"null">
						? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, { nn: false }>>
						: PeekToken<Tokens> extends TokenKey<"default">
							? ParseColumnDefault<SkipToken<Tokens>, C, S>
							: PeekToken<Tokens> extends TokenKey<"primary">
								? PeekToken<SkipToken<Tokens>> extends TokenKey<"key">
									? ParseColumnConstraints<
											SkipToken<SkipToken<Tokens>>,
											C,
											ColumnStateWith<S, { nn: true }>
										>
									: ColumnFail<
											SkipToken<Tokens>,
											C,
											FormatError<
												Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"],
												[]
											>
										>
								: PeekToken<Tokens> extends TokenKey<"unique">
									? ParseColumnConstraints<SkipToken<Tokens>, C, ColumnStateWith<S, {}>>
									: PeekToken<Tokens> extends TokenKey<"check">
										? ParseColumnAfterGroup<SkipParenGroup<SkipToken<Tokens>>, C, S>
										: PeekToken<Tokens> extends TokenKey<"references">
											? ParseColumnAfterReferences<
													ParseReferences<
														SkipToken<Tokens>,
														C["db"],
														C["schema"],
														C["table"]
													>,
													C,
													S
												>
											: PeekToken<Tokens> extends TokenIdent<"collate">
												? ParseColumnConstraints<
														SkipCollationName<SkipToken<Tokens>>,
														C,
														ColumnStateWith<S, {}>
													>
												: PeekToken<Tokens> extends TokenKey<"generated">
													? ParseColumnGenerated<SkipToken<Tokens>, C, S>
													: ColumnFail<
															Tokens,
															C,
															S["afterDefault"] extends true
																? FormatError<
																		Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_DEFAULT_VALUE"],
																		[]
																	>
																: FormatError<
																		Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"],
																		[]
																	>
														>

/** `S` with some fields replaced; `afterDefault` is reset unless the patch sets it. */
type ColumnStateWith<S extends ColumnState, Patch extends Partial<ColumnState>> = {
	nn: Patch extends { nn: infer V extends boolean } ? V : S["nn"]
	def: Patch extends { def: infer V extends boolean } ? V : S["def"]
	gen: Patch extends { gen: infer V extends boolean } ? V : S["gen"]
	afterDefault: Patch extends { afterDefault: infer V extends boolean } ? V : false
}

type ColumnEntry<C extends ColumnCtx, S extends ColumnState> = readonly [
	C["name"],
	C["type"],
	S["nn"],
	S["def"],
	S["gen"],
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

type ParseColumnAfterGroup<G, C extends ColumnCtx, S extends ColumnState> = G extends [
	infer R extends ParserMonad,
	infer E,
]
	? E extends DbtyperErrorShape
		? [R, C["db"], E]
		: ParseColumnConstraints<R, C, ColumnStateWith<S, {}>>
	: never

type ParseColumnAfterReferences<G, C extends ColumnCtx, S extends ColumnState> = ParseColumnAfterGroup<G, C, S>

/** `COLLATE name`, the name possibly qualified or quoted as a string. */
type SkipCollationName<Tokens extends ParserMonad> =
	PeekToken<SkipToken<Tokens>> extends infer T extends { kind: string }
		? PeekToken<SkipToken<SkipToken<Tokens>>> extends TokenKey<".">
			? SkipToken<SkipToken<SkipToken<SkipToken<Tokens>>>>
			: SkipToken<SkipToken<Tokens>> extends infer R extends ParserMonad
				? T extends never
					? never
					: R
				: never
		: never

/** `GENERATED ALWAYS AS (expr) [STORED | VIRTUAL]` (CORE-15, CORE-18); the expression is not typed. */
type ParseColumnGenerated<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenIdent<"always">
		? PeekToken<SkipToken<Tokens>> extends TokenKey<"as">
			? SkipParenGroup<SkipToken<SkipToken<Tokens>>> extends [infer R extends ParserMonad, infer E]
				? E extends DbtyperErrorShape
					? [R, C["db"], E]
					: ParseColumnConstraints<
							PeekToken<R> extends TokenKey<"stored" | "virtual"> ? SkipToken<R> : R,
							C,
							ColumnStateWith<S, { gen: true }>
						>
				: never
			: ColumnFail<SkipToken<Tokens>, C, FormatError<Errors["EXPECTED_AS_AFTER_GENERATED_ALWAYS"], []>>
		: ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_ALWAYS_AFTER_GENERATED"], []>>

/**
 * `DEFAULT <expr>` (CORE-15, CORE-16): the expression is typed like an INSERT value (DML-16) and must fit the column.
 * An unknown function is not checked: function catalogs are the dialects' (PGT-18, SQLT-19).
 */
type ParseColumnDefault<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
	PeekToken<Tokens> extends TokenKey<"," | ")" | ";"> | TokenEot
		? ColumnFail<Tokens, C, FormatError<Errors["EXPECTED_DEFAULT_VALUE"], []>>
		: ParseExpressionAST<Tokens, { db: C["db"]; params: EmptyExpressionParams; outerScope: {} }> extends [
					infer R extends ParserMonad,
					infer Ast,
					infer _Env,
			  ]
			? Ast extends DbtyperErrorShape
				? ColumnFail<R, C, DefaultSyntaxError<Tokens, Ast>>
				: Ast extends ScalarExprAst
					? DefaultFits<ResolveExpressionAST<Ast, C["db"], {}, EmptyExpressionParams>, C> extends infer Err
						? Err extends DbtyperErrorShape
							? ColumnFail<R, C, DefaultSyntaxError<Tokens, Err>>
							: ParseColumnConstraints<R, C, ColumnStateWith<S, { def: true; afterDefault: true }>>
						: never
					: never
			: never

/**
 * A column name inside a function call of a DEFAULT (`now( invalid)`) keeps its old error (SCHEMA-15):
 * a DEFAULT has no columns in scope, so an unknown name there is a broken call.
 */
type DefaultSyntaxError<Tokens extends ParserMonad, Err extends DbtyperErrorShape> = Err extends {
	__sql_parser_error_code__: 2300
}
	? PeekToken<Tokens> extends TokenIdent<string>
		? PeekToken<SkipToken<Tokens>> extends TokenKey<"(">
			? FormatError<Errors["EXPECTED_CLOSE_PAREN_AFTER_FUNCTION_NAME_IN_DEFAULT"], []>
			: Err
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
		? PeekToken<SkipToken<Tokens>> extends TokenKey<".">
			? AsIdent<PeekToken<SkipToken<SkipToken<Tokens>>>> extends TokenIdent<infer B extends string>
				? ReferencesTarget<SkipToken<SkipToken<SkipToken<Tokens>>>, Db, Schema, Table, A, B>
				: SkipFailedExpression<
						SkipToken<SkipToken<Tokens>>,
						FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in REFERENCES"]>
					>
			: ReferencesTarget<SkipToken<Tokens>, Db, Schema, Table, Db["defaultSchema"], A>
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
			? PeekToken<SkipToken<R1>> extends TokenKey<"set">
				? SkipReferenceActions<ReferenceSetAction<SkipToken<SkipToken<R1>>>>
				: PeekToken<SkipToken<R1>> extends TokenIdent<"no">
					? SkipReferenceActions<SkipToken<SkipToken<SkipToken<R1>>>>
					: SkipReferenceActions<SkipToken<SkipToken<R1>>>
			: never
		: PeekToken<Tokens> extends TokenIdent<"match">
			? SkipReferenceActions<SkipToken<SkipToken<Tokens>>>
			: [Tokens, null]

/** After `SET`: `NULL` or `DEFAULT`, optionally followed by a column list. */
type ReferenceSetAction<Tokens extends ParserMonad> =
	SkipToken<Tokens> extends infer R extends ParserMonad
		? PeekToken<R> extends TokenKey<"(">
			? SkipParenGroup<R> extends [infer R2 extends ParserMonad, infer _E]
				? R2
				: never
			: R
		: never

/** `a, b, c)` after `(`: `[rest after ")", names]` or `[rest, error]`. */
type ParseNameList<Tokens extends ParserMonad, Acc extends readonly string[]> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer N extends string>
		? PeekToken<SkipToken<Tokens>> extends TokenKey<",">
			? ParseNameList<SkipToken<SkipToken<Tokens>>, readonly [...Acc, N]>
			: PeekToken<SkipToken<Tokens>> extends TokenKey<")">
				? [SkipToken<SkipToken<Tokens>>, readonly [...Acc, N]]
				: SkipFailedExpression<
						SkipToken<Tokens>,
						FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
					>
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
		? AsIdent<PeekToken<SkipToken<Tokens>>> extends TokenIdent<string>
			? TableConstraintBody<SkipToken<SkipToken<Tokens>>, Db, Schema, Table, Stack>
			: SkipFailedStatement<
					SkipToken<Tokens>,
					Db,
					FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>
				>
		: TableConstraintBody<Tokens, Db, Schema, Table, Stack>

type TableConstraintBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Table extends string,
	Stack extends readonly ColumnDef[],
> =
	PeekToken<Tokens> extends TokenKey<"primary">
		? PeekToken<SkipToken<Tokens>> extends TokenKey<"key">
			? TableConstraintColumns<SkipToken<SkipToken<Tokens>>, Db, Schema, Table, Stack, "PRIMARY KEY", true>
			: SkipFailedStatement<
					SkipToken<Tokens>,
					Db,
					FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>
				>
		: PeekToken<Tokens> extends TokenKey<"unique">
			? TableConstraintColumns<SkipToken<Tokens>, Db, Schema, Table, Stack, "UNIQUE", false>
			: PeekToken<Tokens> extends TokenKey<"check">
				? SkipParenGroup<SkipToken<Tokens>> extends [infer R extends ParserMonad, infer E]
					? E extends DbtyperErrorShape
						? [R, Db, E]
						: AfterTableConstraint<R, Db, Schema, Table, Stack>
					: never
				: PeekToken<Tokens> extends TokenKey<"foreign">
					? PeekToken<SkipToken<Tokens>> extends TokenKey<"key">
						? TableConstraintColumns<
								SkipToken<SkipToken<Tokens>>,
								Db,
								Schema,
								Table,
								Stack,
								"FOREIGN KEY",
								false
							>
						: SkipFailedStatement<
								SkipToken<Tokens>,
								Db,
								FormatError<Errors["EXPECTED_KEY_AFTER_PRIMARY_OR_FOREIGN_IN_CREATE_TABLE"], []>
							>
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
	IsPrimary extends boolean,
> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseNameList<SkipToken<Tokens>, readonly []> extends [infer R extends ParserMonad, infer Names]
			? Names extends DbtyperErrorShape
				? [R, Db, Names]
				: Names extends readonly string[]
					? Exclude<Names[number], Stack[number][0]> extends infer Missing extends string
						? [Missing] extends [never]
							? Kind extends "FOREIGN KEY"
								? PeekToken<R> extends TokenKey<"references">
									? ParseReferences<SkipToken<R>, Db, Schema, Table> extends [
											infer R2 extends ParserMonad,
											infer E,
										]
										? E extends DbtyperErrorShape
											? [R2, Db, E]
											: AfterTableConstraint<R2, Db, Schema, Table, Stack>
										: never
									: SkipFailedStatement<
											R,
											Db,
											FormatError<Errors["EXPECTED_REFERENCES_AFTER_FOREIGN_KEY"], []>
										>
								: AfterTableConstraint<
										R,
										Db,
										Schema,
										Table,
										IsPrimary extends true ? MarkNotNull<Stack, Names[number]> : Stack
									>
							: SkipFailedStatement<R, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Missing, Kind]>>
						: never
					: never
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_IN_CREATE_TABLE_CONSTRAINT"], []>>

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
			: SkipFailedStatement<
					Tokens,
					Db,
					FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_AFTER_COLUMN_DEFINITION"], []>
				>

type MarkNotNull<Stack extends readonly ColumnDef[], Names extends string> = {
	[I in keyof Stack]: Stack[I] extends readonly [
		infer N extends string,
		infer T extends SqlTypeShape,
		boolean,
		infer D extends boolean,
		infer G extends boolean,
	]
		? N extends Names
			? readonly [N, T, true, D, G]
			: Stack[I]
		: never
}

type ColPair = { cols: Record<string, SqlTypeShape>; facts: Record<string, unknown> }

type OneCol<C extends ColumnDef> = C extends readonly [
	infer N extends string,
	infer Sql extends SqlTypeShape,
	infer NotNull extends boolean,
	infer HasDefault extends boolean,
	infer Generated extends boolean,
]
	? {
			cols: Record<N, NotNull extends true ? NotNullType<Sql> : Sql>
			facts: ColumnFacts<N, NotNull, HasDefault, Generated>
		}
	: never

type ColumnFacts<
	N extends string,
	NotNull extends boolean,
	HasDefault extends boolean,
	Generated extends boolean,
> = Generated extends true
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
