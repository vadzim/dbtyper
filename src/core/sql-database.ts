import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape } from "./jsql-shapes.ts"
import type { DbtyperError, DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { Inc } from "./type-utils.ts"
import type { SqlTypeShape } from "./sql-type-shape.ts"
import type { SqlTypeShapeToTs } from "./sql-to-ts-conversion.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqlSelectResultTs } from "./sql-select-result-helper.ts"
import type { DeriveQueryParams } from "./param-probe.ts"
import type {
	ApplyAllowedQueryParams,
	LexerFeatures,
	LexerIndexedQueryParams,
	LexerNamedQueryParams,
} from "../lexer/sql-lexer.ts"
import type { DialectName, Dialects, ParserSyntaxOf } from "./dialect.ts"
import type { JsqlCreateSchema } from "./jsql-utils.ts"

/**
 * Positional PostgreSQL parameters (`$1`, `$2`, …), or a `:name` map — interpreted by drivers such as
 * `postgresSqlDriver`.
 */
export type SqlDriverParams = readonly unknown[] | Record<string, unknown>

/**
 * Type-level description of a driver. `dialect` decides how every migration and query of a chain is parsed
 * (DSEL-1, DSEL-3; src/core/dialect.ts); `syntax` lists the lexer features the driver binds (parameter styles,
 * dollar strings); `scalarTypes` maps SQL type names to TypeScript types.
 */
export type DriverConfig = {
	dialect: DialectName
	syntax: LexerFeatures
	scalarTypes: Record<string, unknown>
	/** Types accepted as parameter VALUES per SQL type, where they differ from the row types (SQLT-32). */
	paramTypes?: Record<string, unknown>
}

/** What `createDriver` accepts: a config that may lack `dialect`; `sqlMigrations` then rejects the driver (DSEL-8). */
type DriverConfigDraft = Omit<DriverConfig, "dialect"> & { dialect?: DialectName }

/**
 * The driver config with only the parameter style the call's values allow. `syntax` is replaced, not intersected:
 * a driver whose syntax is only parameter styles (SQLite) would otherwise reduce the whole config to `never`.
 */
type ParamsDriverConfig<Config extends DriverConfig, ParamsValues> = {
	dialect: Config["dialect"]
	scalarTypes: Config["scalarTypes"]
	syntax: ApplyAllowedQueryParams<
		Config["syntax"],
		ParamsValues extends null | undefined
			? never
			: ParamsValues extends readonly unknown[]
				? LexerIndexedQueryParams
				: LexerNamedQueryParams
	>
}

export type SqlDriver<_Config extends DriverConfigDraft> = {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>>
}

type GetDriverConfig<S extends SqlDriver<DriverConfigDraft>> =
	S extends SqlDriver<infer Driver> ? (Driver extends DriverConfig ? Driver : never) : never

/**
 * DSEL-8: a driver whose config declares no single dialect is a compile error on `driver` at `sqlMigrations`.
 */
type RequireDriverDialect<D> =
	D extends SqlDriver<infer Config>
		? Config extends { dialect: infer Dialect extends DialectName }
			? [DialectName] extends [Dialect]
				? { driver: 'error: the driver must declare one dialect, "postgres" or "sqlite" (DSEL-8)' }
				: {}
			: {
					driver: 'error: the driver declares no dialect; add dialect: "postgres" or "sqlite" to its config (DSEL-8)'
				}
		: {}

/**
 * Wraps query/stream functions as a {@link SqlDriver}. `Config` declares the driver's `dialect`
 * (`"postgres"` or `"sqlite"`, DSEL-8), its lexer `syntax` features and its `scalarTypes` map.
 */
export function createDriver<Config extends DriverConfigDraft>(methods: {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>>
}) {
	return methods as SqlDriver<Config>
}

/** Configuration for {@link sqlMigrations}: logical schema name (default `public`) plus the runtime {@link SqlDriver}. */
type SqlDatabaseConfig<Driver extends SqlDriver<DriverConfigDraft> = SqlDriver<DriverConfig>> = {
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
type InitialDatabase<
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

interface SqlMigrations<Db extends JsqlDatabaseShape, Config extends DriverConfig> {
	apply<Source extends string>(
		statement: Source extends CheckSqlValid<ParamsDriverConfig<Config, null>, Db, Source, EmptyExpressionParams>
			? Source
			: CheckSqlValid<ParamsDriverConfig<Config, null>, Db, Source, EmptyExpressionParams>,
		name?: string,
	): SqlMigrations<
		FlattenedJsqlDatabase<
			ApplyStatements<Db, Source, EmptyExpressionParams, ParserSyntaxOf<ParamsDriverConfig<Config, null>>>[0]
		>,
		Config
	>
	database(): DataBase<FlattenedJsqlDatabase<Db>, Config>
	getDefaultSchema(): string
}

export function sqlMigrations<D extends SqlDriver<DriverConfigDraft>, const DS extends string = "public">(
	config: SqlDatabaseConfig<D> & { defaultSchema?: DS } & RequireDriverDialect<D>,
) {
	const defaultSchema = config.defaultSchema ?? "public"
	const migrations = new DBMigrations(defaultSchema, null, config.driver)
	const result = migrations as unknown as SqlMigrations<
		FlattenedJsqlDatabase<InitialDatabase<GetDriverConfig<D>, DS>>,
		GetDriverConfig<D>
	>
	return result
}

type MigrationExport = {
	source: string
	path: string
}

export function migration<S extends string>(source: S): S {
	if (process.env.TEST_MIGRATIONS) {
		const caller = new Error().stack?.split("\n")[2]
		if (caller && !/\.js:\d+\:\d+\)/.test(caller)) {
			throw new Error(
				"migration() should be called from a JavaScript file while running tests to test that dbtyper works with js",
			)
		}
	}
	return source
}

/** Removes index-signature keys so quick info does not show `[x: string]: …` for every map. */
type NonIndexKey<K extends PropertyKey> = string extends K
	? never
	: number extends K
		? never
		: symbol extends K
			? never
			: K

/**
 * Pretty-printed `JsqlDatabaseShape` for IDE hints: homomorphic mapped types keep index keys from
 * `schemas` / `sets` / `columns`; remapping with {@link NonIndexKey} drops those keys.
 */
type FlattenedJsqlDatabase<Db extends JsqlDatabaseShape> = {
	defaultSchema: Db["defaultSchema"]
	functions: Db["functions"]
	schemas: Db["schemas"] extends infer Schemas
		? {
				[SKey in keyof Schemas as NonIndexKey<SKey>]: Schemas[SKey] extends infer Schema extends JsqlSchemaShape
					? {
							sets: Schema["sets"] extends infer Sets
								? {
										[TKey in keyof Sets as NonIndexKey<TKey>]: Sets[TKey] extends infer Table extends
											JsqlDataShape
											? {
													kind: Table["kind"]
													columns: Table["columns"] extends infer Columns
														? {
																[CK in keyof Columns as NonIndexKey<CK>]: Columns[CK]
															}
														: never
													column_facts: Table["column_facts"] extends infer ColumnFacts
														? [keyof ColumnFacts] extends [never]
															? {}
															: {
																	[FK in keyof ColumnFacts as NonIndexKey<FK>]: ColumnFacts[FK]
																}
														: never
													constraints: Table["constraints"] extends infer Constraints
														? [keyof Constraints] extends [never]
															? {}
															: {
																	[CKe in keyof Constraints as NonIndexKey<CKe>]: Constraints[CKe]
																}
														: never
												} & (Table extends { rowid_table: true } ? { rowid_table: true } : {})
											: never
									}
								: never
							types: Schema["types"] extends infer Types
								? {
										[TKey in keyof Types as NonIndexKey<TKey>]: Types[TKey]
									}
								: {}
						}
					: never
			}
		: never
} & (Db extends { dialect: infer D } ? { dialect: D } : {})

// use SqlStatementsRecovering instead of SqlStatements to run checks and find errors on syntactically correct sqls, like absent tables

type Migrations = {
	last: MigrationExport
	prev: Migrations | null
}

class DBMigrations {
	constructor(defaultSchema: string, migrations: Migrations | null = null, driver: SqlDriver<DriverConfig>) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
		this.#driver = driver
	}

	#migrations: Migrations | null
	#defaultSchema: string
	#driver: SqlDriver<DriverConfig>

	apply(statement: string, name: string = ""): DBMigrations {
		return new DBMigrations(
			this.#defaultSchema,
			{ last: { source: statement, path: name }, prev: this.#migrations },
			this.#driver,
		)
	}

	getDefaultSchema(): string {
		return this.#defaultSchema
	}

	#getMigrations() {
		const result: MigrationExport[] = []
		let current = this.#migrations
		while (current) {
			result.push(current.last)
			current = current.prev
		}
		result.reverse()
		return result
	}

	database() {
		const migrations = this.#getMigrations()
		return new DataBaseImpl(migrations, this.#defaultSchema, this.#driver)
	}
}

type SqlSelectRowObject<
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
			? [Values[K]] extends [
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
type QueryParams<Config extends DriverConfig, Db extends JsqlDatabaseShape, Stmt extends string, Values> =
	DeriveQueryParams<Db, Stmt, ParserSyntaxOf<ParamsDriverConfig<Config, Values>>, Values> extends infer P
		? P extends DbtyperErrorShape
			? P
			: P extends ExpressionParamsShape
				? CheckParamValues<Config, Db, P, Values>
				: never
		: never

type FormatErrorText<Code extends number, Msg extends string> = `error [dbtyper:${Code}]: ${Msg}`

/** Type check for .stream() - requires SELECT or RETURNING */
type CheckSqlValidForStream<
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

type CheckSqlValid<
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
type QueryReturnType<
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
			? []
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

class DataBaseImpl {
	constructor(migrations: readonly MigrationExport[], defaultSchema: string, dbInterface: SqlDriver<DriverConfig>) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
		this.dbInterface = dbInterface
	}

	query(statement: string, params?: Record<string, unknown>): Promise<Array<unknown>> {
		return this.dbInterface.query(statement, params)
	}

	async stream(statement: string, params?: Record<string, unknown>): Promise<AsyncIterable<unknown>> {
		const streamFn = this.dbInterface.stream

		if (streamFn !== undefined) {
			return await streamFn(statement, params)
		}

		const db = this.dbInterface
		const rows = await db.query(statement, params)

		if (!Array.isArray(rows)) {
			throw new Error("stream() requires a row-returning statement (SELECT or RETURNING clause)")
		}

		return (async function* () {
			yield* rows
		})()
	}

	queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<unknown>> {
		return this.query(statement, params)
	}

	async streamUntyped(statement: string, params?: Record<string, unknown>): Promise<AsyncIterable<unknown>> {
		return await this.stream(statement, params)
	}

	migrations: readonly MigrationExport[]
	defaultSchema: string
	dbInterface: SqlDriver<DriverConfig>
}
