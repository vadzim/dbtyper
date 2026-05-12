import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape } from "./jsql-shapes.ts"
import type { DbtyperError, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { PostgresTypeMap } from "../postgres/postgres-type-map.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqlSelectRowSqlTypes } from "./sql-query.ts"
import type { ApplySqlToTsConversion } from "./sql-to-ts-conversion.ts"
import type { InferParamsFromValues } from "./infer-param-types.ts"

/**
 * Positional PostgreSQL parameters (`$1`, `$2`, …), or a `:name` map — interpreted by drivers such as
 * `postgresSqlDriver`.
 */
export type SqlDriverParams = readonly unknown[] | Record<string, unknown>

export type SqlDriver<S extends Record<string, unknown>> = {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): Promise<AsyncIterable<unknown>>
	readonly scalarTypes: S
}

/** Configuration for {@link sqlMigrations}: logical schema name (default `public`) plus the runtime {@link SqlDriver}. */
export type SqlDatabaseConfig<D extends SqlDriver<Record<string, unknown>> = SqlDriver<Record<string, unknown>>> = {
	defaultSchema?: string
	driver: D
}

/** Values object matching `:name` slots implied by {@link ExpressionParamsShape}. */
export type ParamRuntimeValues<Params extends ExpressionParamsShape> = {
	[K in keyof Params]: Params[K] extends { ts: infer T } ? T : never
}

export type SqlDatabase<
	DefaultSchema extends string = "public",
	Functions extends Record<string, string> = Record<string, never>,
> = {
	defaultSchema: DefaultSchema
	schemas: {}
	functions?: Functions
}

export interface SqlMigrations<Db extends JsqlDatabaseShape, ScalarTypes extends Record<string, unknown>> {
	apply<Source extends string>(
		statement: Source extends CheckSqlValid<Db, Source, EmptyExpressionParams>
			? Source
			: CheckSqlValid<Db, Source, EmptyExpressionParams>,
		name?: string,
	): SqlMigrations<FlattenedJsqlDatabase<ApplyStatements<Db, Source>[0]>, ScalarTypes>
	database(): DataBase<FlattenedJsqlDatabase<Db>, ScalarTypes>
	getDefaultSchema(): string
}

export function sqlMigrations<D extends SqlDriver<Record<string, unknown>>, const DS extends string = "public">(
	config: SqlDatabaseConfig<D> & { defaultSchema?: DS },
) {
	const defaultSchema = config.defaultSchema ?? "public"
	const migrations = new DBMigrations(defaultSchema, null, config.driver)
	const result = migrations as unknown as SqlMigrations<
		FlattenedJsqlDatabase<SqlDatabase<DS, Record<string, never>>>,
		InferScalarTypesFromDriver<D>
	>
	return result
}

export type MigrationExport = {
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
export type FlattenedJsqlDatabase<Db extends JsqlDatabaseShape> = {
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
												}
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
}

// use SqlStatementsRecovering instead of SqlStatements to run checks and find errors on syntactically correct sqls, like absent tables

type Migrations = {
	last: MigrationExport
	prev: Migrations | null
}

export class DBMigrations {
	constructor(
		defaultSchema: string,
		migrations: Migrations | null = null,
		driver: SqlDriver<Record<string, unknown>>,
	) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
		this.#driver = driver
	}

	#migrations: Migrations | null
	#defaultSchema: string
	#driver: SqlDriver<Record<string, unknown>>

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

/**
 * Infers the **row object** type for SELECT/RETURNING statements.
 * Used by .stream() which requires statements that return rows.
 */
type SqlSelectRow<
	Db extends JsqlDatabaseShape,
	Text extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = Db extends JsqlDatabaseShape ? ApplySqlToTsConversion<SqlSelectRowSqlTypes<Db, Text, Params>, ScalarTypes> : Db

type SqlSelectRowObject<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape,
> =
	SqlSelectRow<Db, Stmt, ScalarTypes, Params> extends infer R
		? R extends DbtyperErrorShape
			? never
			: { [K in keyof R]: R[K] }
		: never

type FormatErrorText<Code extends number, Msg extends string> = `error [dbtyper:${Code}]: ${Msg}`

/** Type check for .stream() - requires SELECT or RETURNING */
type CheckSqlValidForStream<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape,
> =
	SqlSelectRow<Db, Stmt, ScalarTypes, Params> extends DbtyperError<infer Code, infer Msg>
		? FormatErrorText<Code, Msg>
		: Stmt

type CheckSqlValid<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> = ApplyStatements<Db, Stmt, Params>[1] extends DbtyperError<infer Code, infer Msg> ? FormatErrorText<Code, Msg> : Stmt

/** Return type for .query() - returns typed array for SELECT/RETURNING, unknown for other statements */
type QueryReturnType<
	Db extends JsqlDatabaseShape,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape,
> =
	SqlSelectRow<Db, Stmt, ScalarTypes, Params> extends DbtyperErrorShape
		? unknown
		: Array<SqlSelectRowObject<Db, Stmt, ScalarTypes, Params>>

export type DataBase<Db extends JsqlDatabaseShape, ScalarTypes extends Record<string, unknown>> = {
	/**
	 * Execute any valid SQL statement. Returns typed array for SELECT/RETURNING, unknown for other statements.
	 */
	query<Stmt extends string>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, EmptyExpressionParams>
			? Stmt
			: CheckSqlValid<Db, Stmt, EmptyExpressionParams>,
	): Promise<QueryReturnType<Db, Stmt, ScalarTypes, EmptyExpressionParams>>

	query<Stmt extends string, ParamsValues extends Record<string, unknown>>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, InferParamsFromValues<ParamsValues>>
			? Stmt
			: CheckSqlValid<Db, Stmt, InferParamsFromValues<ParamsValues>>,
		params: ParamsValues,
	): Promise<QueryReturnType<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>>

	query<Stmt extends string, ParamsValues extends readonly unknown[]>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, InferParamsFromValues<ParamsValues>>
			? Stmt
			: CheckSqlValid<Db, Stmt, InferParamsFromValues<ParamsValues>>,
		params: ParamsValues,
	): Promise<QueryReturnType<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>>

	queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<any>>

	/**
	 * Row-by-row iteration. Requires SELECT or RETURNING statements.
	 */
	stream<Stmt extends string>(
		statement: Stmt extends CheckSqlValidForStream<Db, Stmt, ScalarTypes, EmptyExpressionParams>
			? Stmt
			: CheckSqlValidForStream<Db, Stmt, ScalarTypes, EmptyExpressionParams>,
	): Promise<AsyncIterable<SqlSelectRowObject<Db, Stmt, ScalarTypes, EmptyExpressionParams>>>

	stream<Stmt extends string, ParamsValues extends Record<string, unknown>>(
		statement: Stmt extends CheckSqlValidForStream<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>
			? Stmt
			: CheckSqlValidForStream<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>,
		params: ParamsValues,
	): Promise<AsyncIterable<SqlSelectRowObject<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>>>

	stream<Stmt extends string, ParamsValues extends readonly unknown[]>(
		statement: Stmt extends CheckSqlValidForStream<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>
			? Stmt
			: CheckSqlValidForStream<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>,
		params: ParamsValues,
	): Promise<AsyncIterable<SqlSelectRowObject<Db, Stmt, ScalarTypes, InferParamsFromValues<ParamsValues>>>>

	streamUntyped(statement: string, params?: Record<string, unknown>): Promise<AsyncIterable<any>>

	migrations: readonly MigrationExport[]
	defaultSchema: string
}

export class DataBaseImpl {
	constructor(
		migrations: readonly MigrationExport[],
		defaultSchema: string,
		dbInterface: SqlDriver<Record<string, unknown>>,
	) {
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
	dbInterface: SqlDriver<Record<string, unknown>>
}

type DefaultSqlScalarTypeMap = PostgresTypeMap

type InferScalarTypesFromDriver<D extends SqlDriver<Record<string, unknown>>> =
	D extends SqlDriver<infer S> ? S : DefaultSqlScalarTypeMap
