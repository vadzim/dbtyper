import type { JsqlColumnFactsEntry, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { ExprAtom, ExprOk, ExprSqlNull, SameComparisonClass } from "./parse-expression.ts"

type InsertColNotNull<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer F extends { [K: string]: JsqlColumnFactsEntry }
}
	? Col extends keyof F
		? F[Col] extends { nullability: "not_null" }
			? true
			: false
		: false
	: false

export type ValidateMutationValueForColumn<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends ExprAtom,
> = Col extends keyof Tbl["columns"]
	? Tbl["columns"][Col] extends infer ColSql extends string
		? ValidateMutationValueBySql<Tbl, Col, Val, ColSql>
		: ValidateMutationValueBySql<Tbl, Col, Val, "unknown">
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
	: Val extends ExprOk<infer _TsV, infer Sv extends string>
		? SameComparisonClass<Sv, ColSql> extends true
			? true
			: SqlParserError<"Incompatible value type for column">
		: SqlParserError<"Invalid value expression">
