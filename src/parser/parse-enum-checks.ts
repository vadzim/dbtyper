/**
 * PGT-14: an enum is compared with, or assigned, only its own labels. The shapes alone (SameComparisonClass) cannot
 * tell a label from another string, so the checks also see the operand's AST: a string literal is looked up in the
 * enum's labels (read from the chain when used, so ALTER TYPE counts, PGT-13).
 */
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { JsqlEnumLabelUnion } from "../core/jsql-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type EnumName<E extends SqlTypeShape> = E["arg"] extends readonly [infer N extends string, string] ? N : ""

/** Another side of a comparison with / assignment to the enum `E`: `true` or the error. */
type EnumAgainst<Db, E extends SqlTypeShape, Other extends SqlTypeShape, OtherAst> = Other["type"] extends "enum"
	? Other["arg"] extends E["arg"]
		? true
		: FormatError<Errors["INCOMPATIBLE_VALUE_FOR_ENUM"], [EnumName<E>]>
	: OtherAst extends { kind: "string"; value: infer V extends string }
		? [Db] extends [never]
			? true
			: V extends JsqlEnumLabelUnion<Db, E["arg"]>
				? true
				: FormatError<Errors["VALUE_NOT_IN_ENUM"], [V, EnumName<E>]>
		: Other["type"] extends "integer" | "bigint" | "smallint" | "numeric" | "real" | "double precision" | "boolean"
			? FormatError<Errors["INCOMPATIBLE_VALUE_FOR_ENUM"], [EnumName<E>]>
			: true

/** `true`, or the error, for `L op R` when either side is an enum; `true` when none is. */
export type EnumComparisonCheck<
	Db,
	L extends SqlTypeShape,
	LAst,
	R extends SqlTypeShape,
	RAst,
> = L["type"] extends "enum"
	? EnumAgainst<Db, L, R, RAst>
	: R["type"] extends "enum"
		? EnumAgainst<Db, R, L, LAst>
		: true

/** The assignment of `Val` (from `ValAst`) to a column of type `Col`. */
export type EnumAssignmentCheck<
	Db,
	Col extends SqlTypeShape,
	Val extends SqlTypeShape,
	ValAst,
> = Col["type"] extends "enum" ? EnumAgainst<Db, Col, Val, ValAst> : true

/** `Result`, or the enum error `Check` when it is one. */
export type WithEnumCheck<Check, Result> = Check extends true ? Result : Check
