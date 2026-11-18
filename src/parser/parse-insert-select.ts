import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { SkipToken } from "../lexer/parser-monad.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { SameComparisonClass } from "./resolve-expression.ts"
import type { ParseSelectExpression } from "./parse-select.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { FinishInsertSemicolon } from "./parse-insert.ts"

export type ParseInsertWithSelect<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	_Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ParseSelectExpression<SkipToken<Tokens>, Db, Params> extends [
		infer RSelect extends ParserMonad,
		infer _Db2,
		infer SelectRes,
	]
		? SelectRes extends DbtyperErrorShape
			? [RSelect, Db, SelectRes]
			: SelectRes extends JsqlSelectStatementResult
				? ValidateInsertSelectColumns<Tbl, Cols, SelectRes> extends infer ValidationRes
					? ValidationRes extends DbtyperErrorShape
						? [RSelect, Db, ValidationRes]
						: ValidationRes extends true
							? Db extends JsqlDatabaseShape
								? FinishInsertSemicolon<
										RSelect,
										Db,
										{
											kind: "insert"
											table: Tab
											schema: Sch
											columns: Cols
											returning: null
										}
									>
								: never
							: never
					: never
				: never
		: never

type ValidateInsertSelectColumns<
	Tbl extends JsqlDataShape,
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
> =
	ValidateInsertSelectColumnCount<InsertCols, SelectRes> extends infer CountCheck
		? CountCheck extends DbtyperErrorShape
			? CountCheck
			: ValidateInsertSelectColumnTypes<Tbl, InsertCols, SelectRes, InsertCols>
		: never

/** The SELECT's output names in position order (`order`, set by the select parser); without it nothing is checked. */
type SelectOrder<SelectRes extends JsqlSelectStatementResult> = SelectRes extends {
	order: infer O extends readonly string[]
}
	? O
	: null

type ValidateInsertSelectColumnCount<
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
> =
	SelectOrder<SelectRes> extends infer O extends readonly string[]
		? InsertCols["length"] extends O["length"]
			? true
			: FormatError<Errors["INSERT_SELECT_COLUMN_COUNT_MISMATCH"], []>
		: true

type ValidateInsertSelectColumnTypes<
	Tbl extends JsqlDataShape,
	InsertCols extends readonly string[],
	SelectRes extends JsqlSelectStatementResult,
	AllCols extends readonly string[],
	Idx extends readonly unknown[] = [],
> =
	SelectOrder<SelectRes> extends infer O extends readonly string[]
		? InsertCols extends readonly [infer Col extends string, ...infer RestCols extends readonly string[]]
			? O[Idx["length"]] extends infer SelName extends string
				? SelName extends keyof SelectRes["returning"]
					? SelectRes["returning"][SelName] extends infer SelectType extends SqlTypeShape
						? JsqlDataGetColumnType<Tbl, Col> extends infer InsertType extends SqlTypeShape
							? SameComparisonClass<SelectType, InsertType> extends true
								? ValidateInsertSelectColumnTypes<
										Tbl,
										RestCols,
										SelectRes,
										AllCols,
										readonly [...Idx, 0]
									>
								: FormatError<Errors["INSERT_SELECT_TYPE_MISMATCH_FOR_COLUMN"], [Col]>
							: FormatError<Errors["UNKNOWN_COLUMN"], [Col, "INSERT"]>
						: FormatError<Errors["SELECT_RESULT_MISSING_COLUMN"], []>
					: FormatError<Errors["SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS"], []>
				: FormatError<Errors["SELECT_RESULT_COLUMN_INDEX_OUT_OF_BOUNDS"], []>
			: true
		: true
