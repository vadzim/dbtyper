import type { SqlComparisonClass } from "../core/comparison-classes.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { CollectParamProbes, ParamProbeFound, ParamUnresolved, ProbeBinding } from "../core/param-probe.ts"
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
import type { CatalogRowResult, FirstInOrder } from "./function-catalog-result.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"

/** A parameter that no position has typed yet (src/core/param-probe.ts), as an operand's resolved type. */
type ProbeShape<K extends string | number = string | number> = { type: "param-probe"; arg: K }

/** SQLT-9: the type of TRUE/FALSE, of a comparison result and of a condition in the chain's dialect. */
export type DialectBoolean<Db> = SqlType<DialectFact<Db, "booleanType">>

/**
 * CORE-6 (#164): a parameter that is an operand of `||` is text, in every dialect. `never` when neither operand is a
 * parameter without a type.
 */
type ConcatParamProbe<Lv, Rv> =
	Lv extends ProbeShape<infer K>
		? ParamProbeFound<K, SqlText, Rv extends ProbeShape<infer K2> ? [readonly [K2, SqlText]] : []>
		: Rv extends ProbeShape<infer K>
			? ParamProbeFound<K, SqlText>
			: never

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
							? [Op extends "||" ? ConcatParamProbe<Lv, Rv> : never] extends [infer Probe]
								? [Probe] extends [never]
									? Op extends keyof DialectFact<Db, "operatorRows">
										? CatalogRowResult<
												DialectFact<Db, "functionCatalog">,
												DialectFact<Db, "operatorRows">[Op],
												[Lv, Rv]
											>
										: ResolveBuiltinCustomOp<Op, Lv, Rv>
									: Probe
								: never
							: never
						: never
				: never
		: never

type PgJsonTypes = "json" | "jsonb"

type ResolveBuiltinCustomOp<Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Op extends
	"->" | "#>"
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
						? IsSqlTextType<Rv> extends true
							? FormatError<Errors["CANNOT_CONCATENATE_ARRAY_WITH_TEXT"], []>
							: Lv
						: Rv["type"] extends "array"
							? IsSqlTextType<Lv> extends true
								? FormatError<Errors["CANNOT_CONCATENATE_TEXT_WITH_ARRAY"], []>
								: Rv
							: // EXPR-Q6: text || <any non-array type> (either order) is text
								IsSqlTextType<Lv> extends true
								? SqlText
								: IsSqlTextType<Rv> extends true
									? SqlText
									: FormatError<Errors["CONCAT_REQUIRES_AT_LEAST_ONE_TEXT_OPERAND"], []>
					: SqlUnknown

export type IsSqlNumericType<Sql extends string | SqlTypeShape> = Sql extends SqlTypeShape
	? SqlComparisonClass<Sql["type"]> extends "numeric"
		? true
		: false
	: Sql extends string
		? SqlComparisonClass<Sql> extends "numeric"
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

/**
 * Whether a value of type `V` may stand where a condition is needed (WHERE, AND / OR / NOT, CASE WHEN): the dialect's
 * `booleanType` (SQLT-9: an integer in SQLite), or a type of the boolean class.
 */
export type IsConditionType<Db, V extends SqlTypeShape> =
	V["type"] extends DialectFact<Db, "booleanType">
		? true
		: SqlComparisonClass<V["type"]> extends "boolean"
			? true
			: false

/**
 * CORE-6 (#164): a parameter where a condition is needed is a boolean (the dialect's `booleanType`); `Fallback`
 * (the error of the position) for anything else that is not a condition.
 */
export type ConditionProbeOr<Db, V, Fallback> =
	V extends ProbeShape<infer K> ? ParamProbeFound<K, DialectBoolean<Db>> : Fallback

export type MergeBoolNot<Db, V> = V extends DbtyperErrorShape
	? V
	: V extends SqlTypeShape
		? V["type"] extends "null"
			? FormatError<Errors["NOT_ARGUMENT_MUST_BE_BOOLEAN_NOT_NULL"], []>
			: IsConditionType<Db, V> extends true
				? SqlBoolean
				: ConditionProbeOr<Db, V, FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>>
		: FormatError<Errors["NOT_REQUIRES_BOOLEAN_OPERAND"], []>

type BoolBinaryErrors = {
	AND_OPERANDS_MUST_BE_BOOLEAN: FormatError<Errors["AND_OPERANDS_MUST_BE_BOOLEAN"], []>
	OR_OPERANDS_MUST_BE_BOOLEAN: FormatError<Errors["OR_OPERANDS_MUST_BE_BOOLEAN"], []>
}

/** The probe bindings of an AND / OR operand that is a parameter without a type (#164). */
type ConditionBinding<Db, V> = V extends ProbeShape<infer K> ? [readonly [K, DialectBoolean<Db>]] : []

/** An AND / OR with an operand that is no condition: its parameters without a type become booleans, else `Error`. */
type BoolBinaryProbes<Db, L, R, Error> = [...ConditionBinding<Db, L>, ...ConditionBinding<Db, R>] extends readonly [
	readonly [infer K extends string | number, infer S extends SqlTypeShape],
	...infer More extends readonly ProbeBinding[],
]
	? ParamProbeFound<K, S, More>
	: Error

export type MergeBoolBinary<Db, L, R, ErrorId extends keyof BoolBinaryErrors> = L extends DbtyperErrorShape
	? CollectParamProbes<L, R extends DbtyperErrorShape ? R : ConditionProbeOr<Db, R, R>>
	: R extends DbtyperErrorShape
		? L extends ProbeShape<infer K>
			? CollectParamProbes<ParamProbeFound<K, DialectBoolean<Db>>, R>
			: R
		: L extends SqlTypeShape
			? R extends SqlTypeShape
				? L["type"] extends "null"
					? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
					: R["type"] extends "null"
						? FormatError<Errors["NULL_NOT_VALID_BOOLEAN_OPERAND"], []>
						: IsConditionType<Db, L> extends true
							? IsConditionType<Db, R> extends true
								? SqlBoolean
								: BoolBinaryProbes<Db, L, R, BoolBinaryErrors[ErrorId]>
							: BoolBinaryProbes<Db, L, R, BoolBinaryErrors[ErrorId]>
				: BoolBinaryErrors[ErrorId]
			: BoolBinaryErrors[ErrorId]

/** The digits smaller than a digit. */
type SmallerDigits = {
	"0": never
	"1": "0"
	"2": "0" | "1"
	"3": "0" | "1" | "2"
	"4": "0" | "1" | "2" | "3"
	"5": "0" | "1" | "2" | "3" | "4"
	"6": "0" | "1" | "2" | "3" | "4" | "5"
	"7": "0" | "1" | "2" | "3" | "4" | "5" | "6"
	"8": "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7"
	"9": "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"
}

/** `A > B` for two digit strings of the same length. */
type DigitsGreater<A extends string, B extends string> = A extends `${infer Da}${infer Ar}`
	? B extends `${infer Db}${infer Br}`
		? Da extends Db
			? DigitsGreater<Ar, Br>
			: Da extends keyof SmallerDigits
				? Db extends SmallerDigits[Da]
					? true
					: false
				: false
		: false
	: false

/** An integer literal beyond the 32-bit range: more than 10 digits, or 10 digits above 2147483647. */
type IsBigIntegerLiteral<Raw extends string> =
	Raw extends `${infer _1}${infer _2}${infer _3}${infer _4}${infer _5}${infer _6}${infer _7}${infer _8}${infer _9}${infer Rest}`
		? Rest extends ""
			? false
			: Rest extends `${infer _10}${infer More}`
				? More extends ""
					? DigitsGreater<Raw, "2147483647">
					: true
				: false
		: false

/**
 * The type of a number literal, from the dialect's `numberLiterals` fact. SQLT-35: in SQLite a literal with a decimal
 * point or an exponent is REAL, every other one an integer. PGT-35 (#153): in PostgreSQL such a literal is `numeric`
 * and an integer literal beyond the 32-bit range `bigint`.
 */
export type NumberLiteralType<Db, Raw extends string> = Raw extends `0${"x" | "X"}${string}`
	? SqlInteger
	: Raw extends `${string}${"." | "e" | "E"}${string}`
		? SqlType<DialectFact<Db, "numberLiterals">["fraction"]>
		: IsBigIntegerLiteral<Raw> extends true
			? SqlType<DialectFact<Db, "numberLiterals">["big"]>
			: SqlInteger

/**
 * The type of `a op b` for two numeric operands (#153): equal types stay; of two different ones the wider, by the
 * dialect's `numericOrder` (PostgreSQL's numeric hierarchy; SQLT-35: REAL, then NUMERIC); the left operand's type for a
 * type name outside that list.
 */
type ArithmeticResult<Db, Lv extends SqlTypeShape, Rv extends SqlTypeShape> = Lv["type"] extends Rv["type"]
	? Lv
	: FirstInOrder<DialectFact<Db, "numericOrder">, Lv["type"] | Rv["type"]> extends infer Wide
		? [Wide] extends [never]
			? Lv
			: Wide extends Lv["type"]
				? Lv
				: SqlType<Wide & string>
		: never

/** `Op`: "add" / "sub" / "mul" (also `/`), or "" for the operators without date and time rules. */
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
									: IsSqlNumericType<Lv["type"]> extends true
										? IsSqlNumericType<Rv["type"]> extends true
											? ArithmeticResult<Db, Lv, Rv>
											: DatetimeArithmeticOr<Db, Op, Lv, Rv>
										: DatetimeArithmeticOr<Db, Op, Lv, Rv>
							: never
						: never
				: never
		: never

type DatetimeArithmeticOr<Db, Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	PgDatetimeArithmetic<Db, Op, Lv, Rv> extends infer Dt
		? [Dt] extends [never]
			? FormatError<Errors["INCOMPATIBLE_TYPES_IN_ARITHMETIC"], []>
			: Dt
		: never

type TimestampTypes = "timestamp" | "timestamp with time zone" | "timestamp without time zone"
type TimeTypes = "time" | "time with time zone" | "time without time zone"

/**
 * PGT-30: `timestamp ± interval` is the timestamp's type, `timestamp - timestamp` an `interval`, `date ± integer`
 * a `date`, `date - date` an `integer`, `time ± interval` the time's type, `interval ± interval` and
 * `interval * number`, `number * interval`, `interval / number` an `interval` (#162). `never` for any other operands.
 */
type PgDatetimeArithmetic<Db, Op extends string, Lv extends SqlTypeShape, Rv extends SqlTypeShape> =
	DialectFact<Db, "datetimeArithmetic"> extends true
		? Op extends "add" | "sub"
			? Lv["type"] extends TimestampTypes | "date" | TimeTypes
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
			: Op extends "mul"
				? Lv["type"] extends "interval"
					? IsSqlNumericType<Rv["type"]> extends true
						? PgNullableIfEither<Lv, Rv, Lv>
						: never
					: Rv["type"] extends "interval"
						? IsSqlNumericType<Lv["type"]> extends true
							? PgNullableIfEither<Lv, Rv, Rv>
							: never
						: never
				: never
		: never

type PgNullableIfEither<
	Lv extends SqlTypeShape,
	Rv extends SqlTypeShape,
	Result extends SqlTypeShape,
> = Lv["nullable"] extends true ? Nullable<Result> : Rv["nullable"] extends true ? Nullable<Result> : Result

/**
 * Unary minus. CORE-6 (#164): a parameter without a type under it takes the type of the operator's other operand
 * (`id = -$1`, see `ParamOperandProbeKey`); alone it has no type from its position (CORE-7).
 */
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
					: U["type"] extends "interval"
						? U
						: U extends ProbeShape<infer K>
							? ParamUnresolved<K>
							: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
				: FormatError<Errors["UNARY_MINUS_REQUIRES_A_NUMBER"], []>
		: never
