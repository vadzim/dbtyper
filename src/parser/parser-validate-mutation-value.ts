import type { ParamProbeFound, ProbeKeyOf } from "../core/param-probe.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { JsqlColumnFactsEntry, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { EnumAssignmentCheck, WithEnumCheck } from "./parse-enum-checks.ts"
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

export type ValidateMutationValueForColumn<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends SqlTypeShape,
	Db = never,
	ValAst = never,
> =
	JsqlDataGetColumnType<Tbl, Col> extends infer ColSql extends SqlTypeShape
		? WithEnumCheck<
				EnumAssignmentCheck<Db, ColSql, Val, ValAst>,
				ValidateMutationValueBySql<Tbl, Col, Val, ColSql, Db>
			>
		: FormatError<Errors["UNKNOWN_COLUMN"], [Col, "INSERT"]>

type ValidateMutationValueBySql<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends SqlTypeShape,
	ColSql extends SqlTypeShape,
	Db,
> = Val["type"] extends "param-probe"
	? // CORE-6: the column gives an untyped parameter its type (`null` too for a nullable column)
		ParamProbeFound<ProbeKeyOf<Val>, ColSql>
	: Val["type"] extends "null"
		? InsertColNotNull<Tbl, Col> extends true
			? FormatError<Errors["NULL_NOT_ALLOWED_NOT_NULL_COLUMN"], [Col]>
			: true
		: SameComparisonClass<Val, ColSql> extends true
			? true
			: DialectFact<Db, "typeNames"> extends "affinity"
				? // SQLT-43: SQLite would coerce; dbtyper names the column's storage class instead
					FormatError<Errors["COLUMN_TYPE_MISMATCH"], [Col, Uppercase<ColSql["type"]>]>
				: FormatError<Errors["INCOMPATIBLE_VALUE_TYPE_FOR_COLUMN"], [Col]>

/** A generated column (CORE-18) can be read, but never written. */
export type IsGeneratedColumn<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer F extends { [K: string]: JsqlColumnFactsEntry }
}
	? Col extends keyof F
		? F[Col] extends { generated: true | { mode: "stored" | "virtual" } }
			? true
			: false
		: false
	: false
