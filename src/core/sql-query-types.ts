import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { DbtyperError, DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { Inc } from "./type-utils.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"
import type { SqlTypeShapeToTs } from "./sql-to-ts-conversion.ts"
import type { ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqlSelectResultTs, IsDdlStatement } from "./sql-select-result-helper.ts"
import type { DeriveQueryParams } from "./param-probe.ts"
import type { ParserSyntaxOf } from "./dialect.ts"
import type { DriverConfig, ParamsDriverConfig } from "./sql-driver.ts"
import type { SqlMigrations } from "./sql-migrations.ts"
import type { DataBase } from "./sql-database.ts"

export type SqlSelectRowObject<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | DbtyperErrorShape,
> = Params extends ExpressionParamsShape
	? SqlSelectResultTs<Config, Db, Stmt, Params> extends infer R
		? R extends DbtyperErrorShape
			? never
			: { [K in keyof R]: R[K] }
		: never
	: never

type ParamKeyDisplay<K> = K extends `${infer I extends number}` ? `$${Inc<I>}` : K extends string ? `:${K}` : never

/** CORE-6: the first value that is not of the TypeScript type the SQL gives its parameter, as an error. */
type CheckParamValues<Config extends DriverConfig, Db, Params extends ExpressionParamsShape, Values> = {
	[K in keyof Params & string]: K extends keyof Values
		? Params[K] extends infer S extends SqlTypeShape
			? S["type"] extends "param-unused"
				? never // PARAM-14
				: [Values[K]] extends [
							SqlTypeShapeToTs<
								S,
								Config extends { paramTypes: infer P extends Record<string, unknown> }
									? P
									: Config["scalarTypes"],
								Db
							>,
					  ]
					? never
					: FormatError<Errors["INCOMPATIBLE_PARAMETER_VALUE_TYPE"], [ParamKeyDisplay<K>]>
			: never
		: never
}[keyof Params & string] extends infer E
	? [E] extends [never]
		? Params
		: E
	: never

/**
 * The parameter types of a query, derived from the SQL (CORE-6, CORE-7), or the error for a parameter without a
 * derivable type or a value of another type than the SQL's.
 */
export type QueryParams<Config extends DriverConfig, Db extends JsqlDatabaseShape, Stmt extends string, Values> =
	DeriveQueryParams<Db, Stmt, ParserSyntaxOf<ParamsDriverConfig<Config, Values>>, Values> extends infer P
		? P extends DbtyperErrorShape
			? P
			: P extends ExpressionParamsShape
				? CheckParamValues<Config, Db, P, Values>
				: never
		: never

type FormatErrorText<Code extends number, Msg extends string> = `error [dbtyper:${Code}]: ${Msg}`

/** Type check for .stream() - requires SELECT or RETURNING */
export type CheckSqlValidForStream<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | DbtyperErrorShape | null,
> =
	Params extends DbtyperError<infer PCode, infer PMsg>
		? FormatErrorText<PCode, PMsg>
		: Params extends ExpressionParamsShape | null
			? SqlSelectResultTs<Config, Db, Stmt, Params> extends DbtyperError<infer Code, infer Msg>
				? FormatErrorText<Code, Msg>
				: Stmt
			: never

export type CheckSqlValid<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | DbtyperErrorShape | null,
> =
	Params extends DbtyperError<infer PCode, infer PMsg>
		? FormatErrorText<PCode, PMsg>
		: Params extends ExpressionParamsShape | null
			? ApplyStatements<Db, Stmt, Params, ParserSyntaxOf<Config>>[1] extends DbtyperError<infer Code, infer Msg>
				? FormatErrorText<Code, Msg>
				: // CORE-14: a result column with no TypeScript mapping is an error, never `unknown`
					SqlSelectResultTs<Config, Db, Stmt, Params> extends DbtyperError<infer Code, infer Msg>
					? Code extends Errors["STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT"]["code"]
						? Stmt
						: FormatErrorText<Code, Msg>
					: Stmt
			: never

/** Return type for .query() - typed array for SELECT/RETURNING, an empty row list for statements without rows (CORE-13) */
export type QueryReturnType<
	Config extends DriverConfig,
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape | DbtyperErrorShape,
> = Params extends ExpressionParamsShape
	? SqlSelectResultTs<Config, Db, Stmt, Params> extends DbtyperErrorShape
		? SqlSelectResultTs<Config, Db, Stmt, Params> extends DbtyperError<
				Errors["STREAM_REQUIRES_A_ROW_RETURNING_STATEMENT"]["code"],
				string
			>
			? // SCHEMA-6, STMT-Q5: DDL or a skipped statement last: `unknown`; DML without RETURNING: `[]` (CORE-13)
				IsDdlStatement<Db, Stmt, Params, ParserSyntaxOf<Config>> extends true
				? unknown
				: []
			: unknown
		: Array<SqlSelectRowObject<Config, Db, Stmt, Params>>
	: unknown

export type GetApplyError<D, Stmt extends string> =
	D extends SqlMigrations<infer Db, infer Config>
		? CheckSqlValid<ParamsDriverConfig<Config, null>, Db, Stmt, null> extends infer Ret
			? Stmt extends Ret
				? null
				: Ret extends FormatErrorText<infer Code, infer Msg>
					? DbtyperError<Code, Msg>
					: never
			: never
		: never

export type GetQueryError<
	D,
	Stmt extends string,
	ParamsValues extends Record<string, unknown> | readonly unknown[] | null = null,
> =
	D extends DataBase<infer Db, infer Config>
		? CheckSqlValid<
				ParamsDriverConfig<Config, ParamsValues>,
				Db,
				Stmt,
				QueryParams<Config, Db, Stmt, ParamsValues>
			> extends infer Ret
			? Stmt extends Ret
				? null
				: Ret extends FormatErrorText<infer Code, infer Msg>
					? DbtyperError<Code, Msg>
					: never
			: never
		: never

export type GetStreamError<
	D,
	Stmt extends string,
	ParamsValues extends Record<string, unknown> | readonly unknown[] | null = null,
> =
	D extends DataBase<infer Db, infer Config>
		? CheckSqlValidForStream<
				ParamsDriverConfig<Config, ParamsValues>,
				Db,
				Stmt,
				QueryParams<Config, Db, Stmt, ParamsValues>
			> extends infer Ret
			? Stmt extends Ret
				? null
				: Ret extends FormatErrorText<infer Code, infer Msg>
					? DbtyperError<Code, Msg>
					: never
			: never
		: never
