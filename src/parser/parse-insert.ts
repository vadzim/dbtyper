import type { UnionToStringTuple } from "./set-operation-types.ts"
import type { JsqlDatabaseShape, JsqlInsertStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type { ColumnFacts, IsGeneratedColumn, IsIdentityAlwaysColumn } from "./parser-validate-mutation-value.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParseInsertAfterValuesKeyword } from "./parse-insert-values.ts"
import type { ParseInsertOptionalTail } from "./parse-insert-on-conflict.ts"
import type { ColumnNameToken } from "./parse-create-table.ts"
import type { ParseInsertWithSelect } from "./parse-insert-select.ts"
import type { InsertTableContext, InsertRealColumns, ParseInsertFromTableRef } from "./parse-insert-table.ts"

/** Returned when a suffix `ParseInsertValuesCells` pass consumed `)` closing the physical `VALUES` row; tail is handled by the caller. */
export type InsertValuesRowCellsParsedMarker = { readonly __insertValuesRowCellsParsed: true }

/** The column list of an INSERT; a single-quoted name is the identifier where the dialect has `stringColumnNames` (SQLT-68). */
type ParseInsertColumnNameList<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[],
> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? SkipFailedExpression<Tokens, FormatError<Errors["INSERT_COLUMN_LIST_MUST_NOT_BE_EMPTY"], []>>
			: [Tokens, Acc]
		: PeekToken<Tokens> extends infer Tok
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? ColumnNameToken<Tok, Db> extends TokenIdent<infer Col extends string>
					? JsqlDataGetColumnType<Tbl, Col> extends null
						? SkipFailedExpression<R1, FormatError<Errors["UNKNOWN_COLUMN"], [Col, "INSERT column list"]>>
						: Col extends Acc[number]
							? SkipFailedExpression<
									R1,
									FormatError<Errors["DUPLICATE_COLUMN_IN_WRITE"], [Col, "INSERT"]>
								>
							: IsGeneratedColumn<Tbl, Col> extends true
								? IsIdentityAlwaysColumn<Tbl, Col> extends true
									? InsertColumnListNext<R1, Db, Tbl, Acc, Col> // PGT-25: needs OVERRIDING, checked after the list
									: SkipFailedExpression<
											R1,
											FormatError<Errors["CANNOT_WRITE_GENERATED_COLUMN"], [Col, "INSERT"]>
										>
								: InsertColumnListNext<R1, Db, Tbl, Acc, Col>
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in INSERT column list"]>>
				: never
			: never

/** After a column name of the INSERT column list: `)` ends the list, `,` goes on. */
type InsertColumnListNext<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[],
	Col extends string,
> =
	PeekToken<R1> extends TokenKey<")">
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? [R2, readonly [...Acc, Col]]
			: never
		: PeekToken<R1> extends TokenKey<",">
			? ParseInsertColumnNameList<SkipToken<R1>, Db, Tbl, readonly [...Acc, Col]>
			: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_INSERT_COLUMN_LIST"], []>>

type IsNotNullInsertColumn<Tbl extends JsqlDataShape, Col extends string> =
	ColumnFacts<Tbl, Col> extends { nullability: "not_null" }
		? ColumnFacts<Tbl, Col> extends { default: true } | { generated: true | { mode: "stored" | "virtual" } }
			? false
			: true
		: false

type MissingRequiredInsertColumn<Tbl extends JsqlDataShape, Cols extends readonly string[]> = {
	[K in Extract<keyof Tbl["columns"], string>]: IsNotNullInsertColumn<Tbl, K> extends true
		? K extends Cols[number]
			? never
			: K
		: never
}[Extract<keyof Tbl["columns"], string>]

type ValidateInsertRequiredColumns<Tbl extends JsqlDataShape, Cols extends readonly string[]> =
	MissingRequiredInsertColumn<Tbl, Cols> extends infer Missing
		? [Missing] extends [never]
			? true
			: Missing extends string
				? FormatError<Errors["MISSING_NOT_NULL_COLUMN_IN_INSERT"], [Missing]>
				: FormatError<Errors["MISSING_NOT_NULL_COLUMN_IN_INSERT"], [string]>
		: never

/** #150: an INSERT without a column list fills the real columns in declaration order. */
type InsertColumnOrder<Tbl extends JsqlDataShape> = Tbl extends { order: infer O extends readonly string[] }
	? string[] extends O
		? UnionToStringTuple<Extract<keyof InsertRealColumns<Tbl>, string>>
		: O
	: UnionToStringTuple<Extract<keyof InsertRealColumns<Tbl>, string>>

type ParseInsertAfterOpenParenCols<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"values" | "select">
		? // no column list: every column of the table, in declaration order
			ParseInsertAfterColumnNames<Tokens, Db, Scope, Params, Tbl, Sch, Tab, InsertColumnOrder<Tbl>>
		: PeekToken<Tokens> extends TokenKey<"default">
			? SkipToken<Tokens> extends infer Rd extends ParserMonad
				? PeekToken<Rd> extends TokenKey<"values">
					? ValidateInsertRequiredColumns<Tbl, readonly []> extends infer RequiredOk
						? RequiredOk extends DbtyperErrorShape
							? [SkipToken<Rd>, Db, RequiredOk]
							: ParseInsertOptionalTail<
										SkipToken<Rd>,
										Db,
										Scope,
										Params,
										Tbl,
										Sch,
										Tab,
										readonly [],
										undefined,
										undefined
								  > extends [
										infer Rt extends ParserMonad,
										infer DbT extends JsqlDatabaseShape,
										infer ResT,
								  ]
								? [Rt, DbT, ResT]
								: never
						: never
					: SkipFailedStatement<Rd, Db, FormatError<Errors["EXPECTED_VALUES_AFTER_DEFAULT_IN_INSERT"], []>>
				: never
			: PeekToken<Tokens> extends TokenKey<"(">
				? SkipToken<Tokens> extends infer R0 extends ParserMonad
					? ParseInsertColumnNameList<R0, Db, Tbl, readonly []> extends [
							infer R1 extends ParserMonad,
							infer ColsOrErr,
						]
						? ColsOrErr extends DbtyperErrorShape
							? [R1, Db, ColsOrErr]
							: ColsOrErr extends readonly string[]
								? ParseInsertAfterColumnNames<R1, Db, Scope, Params, Tbl, Sch, Tab, ColsOrErr>
								: never
						: never
					: never
				: never

type ParseInsertAfterColumnNames<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	Overriding extends boolean = false,
> =
	PeekToken<R1> extends TokenIdent<"overriding">
		? ParseOverridingClause<SkipToken<R1>> extends [infer R2 extends ParserMonad, infer Err]
			? Err extends DbtyperErrorShape
				? [R2, Db, Err]
				: ParseInsertAfterColumnNames<R2, Db, Scope, Params, Tbl, Sch, Tab, Cols, true>
			: never
		: Overriding extends false
			? IdentityAlwaysInList<Tbl, Cols> extends infer IdCol extends string
				? [IdCol] extends [never]
					? ParseInsertAfterColumnNamesChecked<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: SkipFailedStatement<
							R1,
							Db,
							FormatError<Errors["CANNOT_WRITE_GENERATED_COLUMN"], [IdCol, "INSERT"]>
						>
				: never
			: ParseInsertAfterColumnNamesChecked<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>

/** PGT-25: the first `GENERATED ALWAYS AS IDENTITY` column of the list (written without OVERRIDING), or `never`. */
type IdentityAlwaysInList<Tbl extends JsqlDataShape, Cols extends readonly string[]> = {
	[I in keyof Cols]: IsIdentityAlwaysColumn<Tbl, Cols[I] & string> extends true ? Cols[I] : never
}[number]

/** `OVERRIDING {SYSTEM | USER} VALUE` after `OVERRIDING`: `[rest, null | error]`. */
type ParseOverridingClause<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenIdent<"system" | "user">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenIdent<"value">
				? [SkipToken<R1>, null]
				: SkipFailedExpression<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["OVERRIDING"]>>
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["UNEXPECTED_TOKEN"], ["OVERRIDING"]>>

type ParseInsertAfterColumnNamesChecked<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R1> extends infer TkValues
		? TkValues extends TokenKey<"values">
			? SkipToken<R1> extends infer Rv extends ParserMonad
				? ValidateInsertRequiredColumns<Tbl, Cols> extends infer RequiredColsOk
					? RequiredColsOk extends DbtyperErrorShape
						? [Rv, Db, RequiredColsOk]
						: ParseInsertAfterValuesKeyword<Rv, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: never
				: never
			: TkValues extends TokenKey<"select">
				? ValidateInsertRequiredColumns<Tbl, Cols> extends infer RequiredOk extends DbtyperErrorShape
					? SkipFailedStatement<R1, Db, RequiredOk> // DML-4, DML-21: as for VALUES
					: ParseInsertWithSelect<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: SkipToken<R1> extends infer Rv extends ParserMonad
					? [Rv, Db, FormatError<Errors["EXPECTED_VALUES_OR_SELECT_AFTER_COLUMN_LIST_IN_INSERT"], []>]
					: never
		: never

export type FinishInsertSemicolon<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res extends JsqlInsertStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Res]
		: [Db, PeekToken<Tokens>] extends [{ cteDml: true }, TokenKey<")">]
			? [Tokens, Db, Res] // PGT-26: the INSERT of a data-modifying CTE ends at `)`
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["INSERT"]>>

/** After `INTO`; `Ctes`: the CTE definitions of a `WITH … INSERT` (DML-21), visible by name in its subqueries. */
type ParseInsertAfterInto<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Ctes extends ScopeMap,
> =
	ParseInsertFromTableRef<Tokens, Db, Params> extends [infer R extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
			? Third extends ParserRefErrorThirdSentinel
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends InsertTableContext
					? ParseInsertAfterOpenParenCols<
							R,
							Db,
							MergeScope<Third["scope"], Ctes>,
							Params,
							Third["tbl"],
							Third["schema"],
							Third["table"]
						>
					: never
				: never
		: never

/** The conflict-resolution words after `INSERT OR` / `UPDATE OR` (SQLT-39). */
export type ConflictActionToken =
	TokenKey<"replace"> | TokenIdent<"abort"> | TokenIdent<"fail"> | TokenIdent<"ignore"> | TokenIdent<"rollback">

/** After `INSERT` (or `REPLACE`, which is `INSERT OR REPLACE`): `[OR action] INTO …`. */
export type ParseInsert<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Ctes extends ScopeMap = {},
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends ConflictActionToken
				? ParseInsertInto<SkipToken<R1>, Db, Params, Ctes>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CONFLICT_ACTION_AFTER_OR"], []>>
			: never
		: ParseInsertInto<Tokens, Db, Params, Ctes>

type ParseInsertInto<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Ctes extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"into">
		? ParseInsertAfterInto<SkipToken<Tokens>, Db, Params, Ctes>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_INTO_AFTER_INSERT"], []>>
