import type { JsqlColumnFactsEntry, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { FormatError } from "../sql-parser-error.ts"
import type { SameComparisonClass } from "./parse-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type InsertColNotNull<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer F extends { [K: string]: JsqlColumnFactsEntry }
}
	? Col extends keyof F
		? F[Col] extends { nullability: "not_null" }
			? true
			: false
		: false
	: false

export type ValidateMutationValueForColumn<Tbl extends JsqlDataShape, Col extends string, Val extends SqlTypeShape> =
	JsqlDataGetColumnType<Tbl, Col> extends infer ColSql extends SqlTypeShape
		? ValidateMutationValueBySql<Tbl, Col, Val, ColSql>
		: FormatError<"UNKNOWN_COLUMN_INSERT", [Col]>

type ValidateMutationValueBySql<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends SqlTypeShape,
	ColSql extends SqlTypeShape,
> = Val["type"] extends "null"
	? InsertColNotNull<Tbl, Col> extends true
		? FormatError<"NULL_NOT_ALLOWED_NOT_NULL_COLUMN", [Col]>
		: true
	: SameComparisonClass<Val, ColSql> extends true
		? true
		: FormatError<"INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN", [Col]>
