import type { ParamProbeFound, ProbeKeyOf } from "../core/param-probe.ts"
import type { ValueMismatchError } from "../core/dialect-types.ts"
import type { ComparisonClassesOf } from "../core/dialect.ts"
import type { JsqlColumnFactsEntry, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { EnumAssignmentCheck, WithEnumCheck } from "./parse-enum-checks.ts"
import type { SameComparisonClass } from "./resolve-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

/** The facts recorded for a column (`column_facts`): its entry, or `{}` when it has none. */
export type ColumnFacts<Tbl extends JsqlDataShape, Col extends string> = Tbl extends {
	column_facts: infer F extends { [K: string]: JsqlColumnFactsEntry }
}
	? Col extends keyof F
		? F[Col]
		: {}
	: {}

type InsertColNotNull<Tbl extends JsqlDataShape, Col extends string> =
	ColumnFacts<Tbl, Col> extends { nullability: "not_null" } ? true : false

export type ValidateMutationValueForColumn<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends SqlTypeShape,
	Db = never,
	ValAst = never,
> =
	JsqlDataGetColumnType<Tbl, Col> extends infer ColSql extends SqlTypeShape
		? WithEnumCheck<
				EnumAssignmentCheck<Db, ColSql, ValAst>,
				ValidateMutationValueBySql<Tbl, Col, Val, ColSql, Db, ValAst>
			>
		: FormatError<Errors["UNKNOWN_COLUMN"], [Col, "INSERT"]>

type ValidateMutationValueBySql<
	Tbl extends JsqlDataShape,
	Col extends string,
	Val extends SqlTypeShape,
	ColSql extends SqlTypeShape,
	Db,
	ValAst,
> = Val["type"] extends "param-probe"
	? // CORE-6: the column gives an untyped parameter its type (`null` too for a nullable column)
		ParamProbeFound<ProbeKeyOf<Val>, ColSql>
	: Val["type"] extends "null"
		? InsertColNotNull<Tbl, Col> extends true
			? FormatError<Errors["NULL_NOT_ALLOWED_NOT_NULL_COLUMN"], [Col]>
			: true
		: SameComparisonClass<Val, ColSql, ValAst, never, ComparisonClassesOf<Db>> extends true
			? true
			: ValueMismatchError<Db, Col, ColSql["type"]>

/** A generated column (CORE-18) can be read, but never written. */
export type IsGeneratedColumn<Tbl extends JsqlDataShape, Col extends string> =
	ColumnFacts<Tbl, Col> extends { generated: true | { mode: "stored" | "virtual" } } ? true : false

/** PGT-25: a `GENERATED ALWAYS AS IDENTITY` column: not insertable unless `OVERRIDING {SYSTEM|USER} VALUE`. */
export type IsIdentityAlwaysColumn<Tbl extends JsqlDataShape, Col extends string> =
	ColumnFacts<Tbl, Col> extends { identity: true } ? true : false
