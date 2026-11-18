import type { JsqlDatabaseShape } from "./jsql-shapes.ts"
import type { EmptyExpressionParams } from "../parser/parse-expression.ts"
import type { Dialects } from "./dialect.ts"
import type { JsqlCreateSchema } from "./jsql-utils.ts"
import type { MigrationExport } from "./sql-migrations.ts"
import type { DriverConfig, DriverConfigDraft, ParamsDriverConfig, SqlDriver } from "./sql-driver.ts"
import type {
	CheckSqlValid,
	CheckSqlValidForStream,
	QueryParams,
	QueryReturnType,
	SqlSelectRowObject,
} from "./sql-query-types.ts"

/** Configuration for {@link sqlMigrations}: logical schema name (default `public`) plus the runtime {@link SqlDriver}. */
export type SqlDatabaseConfig<Driver extends SqlDriver<DriverConfigDraft> = SqlDriver<DriverConfig>> = {
	defaultSchema?: string
	driver: Driver
}

type SqlDatabase<
	DefaultSchema extends string = "public",
	Functions extends Record<string, string> = Record<string, never>,
> = {
	defaultSchema: DefaultSchema
	schemas: {}
	functions?: Functions
}

/** The schema a new chain starts from: empty, or with the default schema when the dialect has it built in. */
export type InitialDatabase<
	Config extends DriverConfig,
	DS extends string,
> = Dialects[Config["dialect"]]["defaultSchemaExists"] extends true
	? {
			// SQLT-25: SQLite has no schemas, only `main` (the default) and `temp`
			defaultSchema: "main"
			// #102: the mapped form below must depend on `DS` (`DS & never` is `never`, adds no key). Compile cost:
			// with a plain literal `{ main: ...; temp: ... }` every `.apply()` of a SQLite chain costs ~6x more
			// instantiations (per-step instantiations are not cached) and 18 chained CREATE TABLEs hit TS2589.
			// A plain literal is FORBIDDEN here; test/sqlite/sqlt-102-long-chain.test-d.ts guards it.
			schemas: { [K in "main" | "temp" | (DS & never)]: JsqlCreateSchema }
			functions?: Record<string, never>
			dialect: Config["dialect"]
		}
	: SqlDatabase<DS, Record<string, never>>

export type DataBase<Db extends JsqlDatabaseShape, Config extends DriverConfig> = {
	__db(): { [K in keyof Db]: Db[K] }
	__config(): { [K in keyof Config]: Config[K] }
	// _config_params<ParamsValues extends Record<string, unknown> | readonly unknown[]>(
	// 	params: ParamsValues,
	// ): { [K in keyof ParamsDriverConfig<Config, ParamsValues>]: ParamsDriverConfig<Config, ParamsValues>[K] }
	// _get_params<ParamsValues extends Record<string, unknown> | readonly unknown[]>(params: ParamsValues): ParamsValues
	// _params_no_any<Stmt extends string>(statement: Stmt): CheckSqlValid<Config, Db, Stmt, EmptyExpressionParams>
	// _params_no<Stmt extends string>(
	// 	statement: Stmt,
	// ): CheckSqlValid<NoParamsDriverConfig<Config,null>, Db, Stmt, EmptyExpressionParams>
	// _params<Stmt extends string, ParamsValues extends Record<string, unknown> | readonly unknown[]>(
	// 	statement: Stmt,
	// 	params: ParamsValues,
	// ): CheckSqlValid<ParamsDriverConfig<Config, ParamsValues>, Db, Stmt, QueryParams<Config, Db, Stmt, ParamsValues>>
	// _params_any<Stmt extends string, ParamsValues extends Record<string, unknown> | readonly unknown[]>(
	// 	statement: Stmt,
	// 	params: ParamsValues,
	// ): CheckSqlValid<Config, Db, Stmt, QueryParams<Config, Db, Stmt, ParamsValues>>

	/**
	 * Execute any valid SQL statement. Returns typed array for SELECT/RETURNING, `[]` for other statements (CORE-13).
	 */
	query<Stmt extends string>(
		statement: Stmt extends CheckSqlValid<ParamsDriverConfig<Config, null>, Db, Stmt, EmptyExpressionParams>
			? Stmt
			: CheckSqlValid<ParamsDriverConfig<Config, null>, Db, Stmt, EmptyExpressionParams>,
	): Promise<QueryReturnType<ParamsDriverConfig<Config, null>, Db, Stmt, EmptyExpressionParams>>

	query<Stmt extends string, ParamsValues extends Record<string, unknown> | readonly unknown[] | readonly []>(
		statement: Stmt extends CheckSqlValid<
			ParamsDriverConfig<Config, ParamsValues>,
			Db,
			Stmt,
			QueryParams<Config, Db, Stmt, ParamsValues>
		>
			? Stmt
			: CheckSqlValid<
					ParamsDriverConfig<Config, ParamsValues>,
					Db,
					Stmt,
					QueryParams<Config, Db, Stmt, ParamsValues>
				>,
		params: ParamsValues,
	): Promise<
		QueryReturnType<ParamsDriverConfig<Config, ParamsValues>, Db, Stmt, QueryParams<Config, Db, Stmt, ParamsValues>>
	>

	queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<any>>

	/**
	 * Row-by-row iteration. Requires SELECT or RETURNING statements.
	 */
	stream<Stmt extends string>(
		statement: Stmt extends CheckSqlValidForStream<
			ParamsDriverConfig<Config, null>,
			Db,
			Stmt,
			EmptyExpressionParams
		>
			? Stmt
			: CheckSqlValidForStream<ParamsDriverConfig<Config, null>, Db, Stmt, EmptyExpressionParams>,
	): Promise<AsyncIterable<SqlSelectRowObject<ParamsDriverConfig<Config, null>, Db, Stmt, EmptyExpressionParams>>>

	stream<Stmt extends string, ParamsValues extends Record<string, unknown> | readonly unknown[] | readonly []>(
		statement: Stmt extends CheckSqlValidForStream<
			ParamsDriverConfig<Config, ParamsValues>,
			Db,
			Stmt,
			QueryParams<Config, Db, Stmt, ParamsValues>
		>
			? Stmt
			: CheckSqlValidForStream<
					ParamsDriverConfig<Config, ParamsValues>,
					Db,
					Stmt,
					QueryParams<Config, Db, Stmt, ParamsValues>
				>,
		params: ParamsValues,
	): Promise<
		AsyncIterable<
			SqlSelectRowObject<
				ParamsDriverConfig<Config, ParamsValues>,
				Db,
				Stmt,
				QueryParams<Config, Db, Stmt, ParamsValues>
			>
		>
	>

	streamUntyped(statement: string, params?: Record<string, unknown>): Promise<AsyncIterable<any>>

	migrations: readonly MigrationExport[]
	defaultSchema: string
}

// Public entry of the database API; the parts live in sql-driver.ts, sql-migrations.ts and sql-query-types.ts.
export { createDriver } from "./sql-driver.ts"
export type { DriverConfig, SqlDriver, SqlDriverParams } from "./sql-driver.ts"
export { migration, sqlMigrations } from "./sql-migrations.ts"
export type { GetApplyError, GetQueryError, GetStreamError } from "./sql-query-types.ts"
