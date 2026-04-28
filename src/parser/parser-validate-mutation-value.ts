import type { JsqlColumnFactsMap, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { ExprAtom, ExprOk, ExprSqlNull, SameComparisonClass } from "./parse-expression.ts"

type InsertColNotNull<Tbl extends JsqlTableShape, Col extends string> = Tbl extends {
	column_facts: infer F extends JsqlColumnFactsMap
}
	? Col extends keyof F
		? F[Col] extends { not_null: true }
			? true
			: false
		: false
	: false

export type ValidateMutationValueForColumn<
	Tbl extends JsqlTableShape,
	Col extends string,
	Val extends ExprAtom,
> = Col extends keyof Tbl["columns"]
	? Tbl["columns"][Col] extends infer ColTs
		? Val extends ExprSqlNull
			? InsertColNotNull<Tbl, Col> extends true
				? SqlParserError<"NULL not allowed for NOT NULL column">
				: true
			: Val extends ExprOk<infer TsV, infer _Sv>
				? SameComparisonClass<TsV, ColTs> extends true
					? true
					: SqlParserError<"Incompatible value type for column">
				: SqlParserError<"Invalid value expression">
		: never
	: SqlParserError<"Unknown column in INSERT">
