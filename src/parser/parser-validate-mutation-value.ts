import type { JsqlColumnFactsEntry, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ExprAtom, ExprOk, ExprSqlNull, SameComparisonClass } from "./parse-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"

type InsertColNotNull<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer F extends { [K: string]: JsqlColumnFactsEntry }
}
	? Col extends keyof F
		? F[Col] extends { nullability: "not_null" }
			? true
			: false
		: false
	: false

export type ValidateMutationValueForColumn<Tbl extends JsqlDataShape, Col extends string, Val extends ExprAtom> =
	JsqlDataGetColumnType<Tbl, Col> extends infer ColSql extends string
		? ValidateMutationValueBySql<Tbl, Col, Val, ColSql>
		: SqlParserError<"Unknown column in INSERT">

type ValidateMutationValueBySql<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends ExprAtom,
	ColSql extends string,
> = Val extends ExprSqlNull
	? InsertColNotNull<Tbl, Col> extends true
		? SqlParserError<"NULL not allowed for NOT NULL column">
		: true
	: Val extends ExprOk<infer Sv extends string>
		? SameComparisonClass<Sv, ColSql> extends true
			? true
			: SqlParserError<"Incompatible value type for column">
		: SqlParserError<"Invalid value expression">
