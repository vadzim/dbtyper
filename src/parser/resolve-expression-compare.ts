import type { ShapeComparisonClass, SqlComparisonClass, StringLiteralClasses } from "../core/comparison-classes.ts"
import type { SqlBoolean, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { Errors, FormatError } from "../dbtyper-error.ts"
import type { IsSqlTextType } from "./resolve-operators.ts"

/** PGT-16: `Ast` is an untyped string literal and `Other` is of a class that takes one without a cast. */
type StringLiteralFits<Ast, Other extends SqlTypeShape> = [Ast] extends [never]
	? false
	: Ast extends { kind: "string"; blob: true }
		? false
		: Ast extends { kind: "string" }
			? ShapeComparisonClass<Other> extends StringLiteralClasses
				? true
				: false
			: false

/**
 * EXPR-26: two operands are compatible when their classes are equal or either is "unknown", or one is an untyped
 * string literal (its AST, when the caller has it) and the other a class that takes one (PGT-16).
 */
export type SameComparisonClass<
	SqlL extends string | SqlTypeShape,
	SqlR extends string | SqlTypeShape,
	AstL = never,
	AstR = never,
> = SqlL extends SqlTypeShape
	? SqlR extends SqlTypeShape
		? ShapeComparisonClass<SqlL> extends "unknown"
			? true
			: ShapeComparisonClass<SqlR> extends "unknown"
				? true
				: ShapeComparisonClass<SqlL> extends ShapeComparisonClass<SqlR>
					? true
					: StringLiteralFits<AstL, SqlR> extends true
						? true
						: StringLiteralFits<AstR, SqlL>
		: false
	: SqlR extends SqlTypeShape
		? false
		: SqlL extends string
			? SqlR extends string
				? SqlComparisonClass<SqlL> extends "unknown"
					? true
					: SqlComparisonClass<SqlR> extends "unknown"
						? true
						: SqlComparisonClass<SqlL> extends SqlComparisonClass<SqlR>
							? true
							: false
				: false
			: false

export type MergeComparison<
	L extends SqlTypeShape,
	R extends SqlTypeShape,
	LAst = never,
	RAst = never,
> = L["type"] extends "null"
	? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
	: R["type"] extends "null"
		? FormatError<Errors["USE_IS_NULL_INSTEAD_OF_EQUALS_NULL"], []>
		: SameComparisonClass<L, R, LAst, RAst> extends true
			? SqlBoolean
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_COMPARISON"], []>

/** Simple `CASE expr WHEN value` — each `value` must be `=`-compatible with `expr` (same errors as comparisons). */

export type MergeBetweenBounds<
	E extends SqlTypeShape,
	Lm extends SqlTypeShape,
	H extends SqlTypeShape,
	EAst = never,
	LmAst = never,
	HAst = never,
> = E["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
	: Lm["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
		: H["type"] extends "null"
			? FormatError<Errors["NULL_NOT_ALLOWED_IN_BETWEEN"], []>
			: SameComparisonClass<E, Lm, EAst, LmAst> extends true
				? SameComparisonClass<E, H, EAst, HAst> extends true
					? SqlBoolean
					: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>
				: FormatError<Errors["INCOMPATIBLE_TYPES_IN_BETWEEN"], []>

export type MergeLikeOperands<Expr extends SqlTypeShape, Pat extends SqlTypeShape> = Expr["type"] extends "null"
	? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
	: Pat["type"] extends "null"
		? FormatError<Errors["NULL_NOT_ALLOWED_IN_LIKE"], []>
		: IsSqlTextType<Expr> extends true
			? IsSqlTextType<Pat> extends true
				? SqlBoolean
				: FormatError<Errors["LIKE_PATTERN_MUST_BE_TEXT"], []>
			: FormatError<Errors["LIKE_LEFT_OPERAND_MUST_BE_TEXT"], []>

/** CORE-2, CORE-5: a CASE result is nullable when any branch is (a NULL literal branch included). */
