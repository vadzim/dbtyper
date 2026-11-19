import type { SqlComparisonClass } from "../core/comparison-classes.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type {
	Nullable,
	SqlBoolean,
	SqlInteger,
	SqlText,
	SqlType,
	SqlTypeShape,
	SqlUnknown,
} from "../core/sql-type-shape.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { SqliteRowResult } from "./function-catalog.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { SqliteOperators } from "./sqlite-functions.ts"

export type ResolveCustomOp<
	Op extends string,
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? DialectFact<Db, "operators"> extends "affinity"
								? Op extends keyof SqliteOperators
									? SqliteRowResult<SqliteOperators[Op], [Lv, Rv]>
									: ResolveBuiltinCustomOp<Op, Lv, Rv>
								: ResolveBuiltinCustomOp<Op, Lv, Rv>
							: never
						: never
				: never
		: never

type PgJsonTypes = "json" | "jsonb"

type ResolveBuiltinCustomOp<Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Op extends
	| "->"
	| "#>"
	? Lv["type"] extends PgJsonTypes
		? Nullable<{ type: Lv["type"]; arg: null; nullable: false }> // PGT-24: the operand's json type, NULL when the key is missing
		: SqlUnknown
	: Op extends "->>" | "#>>"
		? Nullable<SqlText> // PGT-24
		: Op extends "@>" | "<@" | "?" | "?|" | "?&"
			? Lv["type"] extends PgJsonTypes
				? PgNullableIfEither<Lv, Rv, SqlBoolean> // PGT-24: jsonb containment and key existence
				: Op extends "@>" | "<@"
					? SqlBoolean
					: SqlUnknown
			: Op extends "&&"
				? SqlBoolean
				: Op extends "||"
					? Lv["type"] extends "array"
						? Rv["type"] extends "text"
							? FormatError<Errors["CANNOT_CONCATENATE_ARRAY_WITH_TEXT"], []>
							: Rv["type"] extends "array"
								? Lv
								: Lv
						: Rv["type"] extends "array"
							? Lv["type"] extends "text"
								? FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_ARRAY"], []>
								: Rv
							: Lv["type"] extends "text"
								? Rv["type"] extends "text" | "integer" | "bigint" | "numeric" | "uuid" | "boolean"
									? SqlText
									: FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_TYPE"], [Rv["type"]]>
								: Rv["type"] extends "text"
									? Lv["type"] extends "integer" | "bigint" | "numeric" | "uuid" | "boolean"
										? SqlText
										: FormatError<Errors["CANNOT_CONCATENATE_TYPE_WITH_TEXT"], [Lv["type"]]>
									: FormatError<Errors["CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND"], []>
					: SqlUnknown

type IsSqlNumericType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "numeric"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "numeric"
			? true
			: false
		: false

export type IsSqlBooleanType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "boolean"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "boolean"
			? true
			: false
		: false

export type IsSqlTextType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "text"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "text"
			? true
			: false
		: false

export type MergeBoolNot<V> = V extends DbtyperErrorShape
	? V
	: V extends SqlTypeShape
		? V["type"] extends "null"
			? FormatError<Errors["NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL"], []>
			: IsSqlBooleanType<V> extends true
				? SqlBoolean
				: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>
		: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>

export type MergeBoolBinary<
	L,
	R,
	ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN" | "OR_OPERANDS_MUST_BE_BOOLEAN",
> = L extends DbtyperErrorShape
	? L
	: R extends DbtyperErrorShape
		? R
		: L extends SqlTypeShape
			? R extends SqlTypeShape
				? L["type"] extends "null"
					? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
					: R["type"] extends "null"
						? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
						: IsSqlBooleanType<L> extends true
							? IsSqlBooleanType<R> extends true
								? SqlBoolean
								: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
									? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
									: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
							: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
								? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
								: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
				: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
					? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
					: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
			: ErrorId extends "AND_OPERANDS_MUST_BE_BOOLEAN"
				? FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
				: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>

/** SQLT-35: in SQLite a literal with a decimal point or an exponent is REAL; elsewhere every number literal is the integer shape. */
export type NumberLiteralType<Db, Raw extends string> =
	DialectFact<Db, "numberTyping"> extends "affinity"
		? Raw extends `0${"x" | "X"}${string}`
			? SqlInteger
			: Raw extends `${string}${"." | "e" | "E"}${string}`
				? SqlType<"real">
				: SqlInteger
		: SqlInteger

/**
 * The type of `a op b` for two numeric operands: the left operand's, except where the type names are affinities
 * (SQLite, SQLT-35): with any REAL operand the result is REAL, else a NUMERIC operand makes it NUMERIC.
 */
type ArithmeticResult<Db, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	DialectFact<Db, "numberTyping"> extends "affinity"
		? "real" extends Lv["type"] | Rv["type"]
			? SqlType<"real">
			: "numeric" extends Lv["type"] | Rv["type"]
				? SqlType<"numeric">
				: Lv
		: Lv

export type ResolveScalarExprAstPair<
	L extends ScalarExprAst,
	R extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Op extends string = "",
> =
	ResolveExpressionAST<L, Db, Scope, Params> extends infer Lv
		? Lv extends DbtyperErrorShape
			? Lv
			: ResolveExpressionAST<R, Db, Scope, Params> extends infer Rv
				? Rv extends DbtyperErrorShape
					? Rv
					: Lv extends SqlTypeShape
						? Rv extends SqlTypeShape
							? Lv["type"] extends "null"
								? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
								: Rv["type"] extends "null"
									? FormatError<Errors["NULL_NOT_ALLOWED_ARITHMETIC"], []>
									: PgDatetimeArithmetic<Db, Op, Lv, Rv> extends infer Dt
										? [Dt] extends [never]
											? ResolveNumericPair<Db, Lv, Rv>
											: Dt
										: never
							: never
						: never
				: never
		: never

/**
 * PGT-30: `timestamp ± interval` is the timestamp's type, `timestamp - timestamp` an `interval`, `date ± integer`
 * a `date`, `date - date` an `integer`. `never` for any other operands (the numeric rules apply).
 */
type PgDatetimeArithmetic<Db, Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Op extends
	| "add"
	| "sub"
	? DialectFact<Db, "datetimeArithmetic"> extends true
		? Lv["type"] extends "timestamp" | "timestamp with time zone" | "timestamp without time zone" | "date"
			? Rv["type"] extends "interval"
				? PgNullableIfEither<Lv, Rv, Lv>
				: Lv["type"] extends "date"
					? Rv["type"] extends "integer" | "smallint" | "bigint"
						? PgNullableIfEither<Lv, Rv, Lv>
						: Op extends "sub"
							? Rv["type"] extends "date"
								? PgNullableIfEither<Lv, Rv, SqlInteger>
								: never
							: never
					: Op extends "sub"
						? Rv["type"] extends Lv["type"]
							? PgNullableIfEither<Lv, Rv, SqlType<"interval">>
							: never
						: never
			: Lv["type"] extends "interval"
				? Rv["type"] extends "interval"
					? PgNullableIfEither<Lv, Rv, Lv>
					: never
				: never
		: never
	: never

type PgNullableIfEither<
	Lv extends SqlTypeShape,
	Rv extends SqlTypeShape,
	Result extends SqlTypeShape,
> = Lv["nullable"] extends true ? Nullable<Result> : Rv["nullable"] extends true ? Nullable<Result> : Result

type ResolveNumericPair<Db, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	IsSqlNumericType<Lv["type"]> extends true
		? IsSqlNumericType<Rv["type"]> extends true
			? ArithmeticResult<Db, Lv, Rv>
			: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>
		: FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>

export type ResolveScalarExprAstNeg<
	I extends ScalarExprAst,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ResolveExpressionAST<I, Db, Scope, Params> extends infer U
		? U extends DbtyperErrorShape
			? U
			: U extends SqlTypeShape
				? IsSqlNumericType<U["type"]> extends true
					? U
					: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
				: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
		: never
