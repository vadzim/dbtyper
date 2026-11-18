import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { EnumAssignmentCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipBracketedUntil, SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { JsqlDbReplaceColumn } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { EmptyExpressionParams, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST, SameComparisonClass } from "./resolve-expression.ts"
import type { FinishAlterStatement, ParseAlterActions } from "./parse-alter-table.ts"
import type { ColumnDef, PkKind, WithPendingConstraint } from "./parse-create-table.ts"
import type { ParseCreateTableBody } from "./parse-create-table-columns.ts"
import type { ParseReferences } from "./parse-column-references.ts"
import type { OneCol } from "./parse-create-table-merge.ts"

export type SerialName = "serial" | "bigserial" | "smallserial" | "serial2" | "serial4" | "serial8"

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
export type ParseColumnConstraints<Tokens extends ParserMonad, C extends ColumnCtx, S extends ColumnState> =
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
export type SkipParenGroup<Tokens extends ParserMonad> =
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
								C,
								Ast
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
type DefaultFits<V, C extends ColumnCtx, Ast = never> = V extends {
	__sql_parser_error_code__: Errors["UNKNOWN_FUNCTION"]["code"]
}
	? null
	: V extends DbtyperErrorShape
		? V
		: V extends SqlTypeShape
			? V["type"] extends "null"
				? null
				: WithEnumCheck<
							EnumAssignmentCheck<C["db"], C["type"], Ast>,
							SameComparisonClass<V, C["type"], Ast>
					  > extends infer Fit
					? Fit extends DbtyperErrorShape
						? Fit
						: Fit extends true
							? null
							: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [C["name"]]>
					: never
			: never
