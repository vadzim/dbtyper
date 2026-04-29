import type { MergeDbPreserveScalars } from "../../core/sql-scalar-types.ts"
import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { PostgresTypeMap } from "../postgres/postgres-type-map.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqlSelectRow } from "./sql-query.ts"

/** Default `scalarTypes` for {@link SqlDatabase} / {@link sqlDatabase}; same keys as {@link PostgresTypeMap}. */
type DefaultSqlScalarTypeMap = PostgresTypeMap

export type { MergeDbPreserveScalars }

/**
 * Positional PostgreSQL parameters (`$1`, `$2`, …), or a `:name` map — interpreted by drivers such as
 * `postgresSqlDriver`.
 */
export type SqlDriverParams = readonly unknown[] | Record<string, unknown>

export type SqlDriver<S extends Record<string, unknown>> = {
	query(sql: string, params?: SqlDriverParams): Promise<Array<unknown>>
	stream?(sql: string, params?: SqlDriverParams): AsyncIterable<unknown>
	readonly scalarTypes: S
}

/** Scalar map inferred from {@link SqlDriver}'s type parameter; used by {@link sqlDatabase}. */
export type InferScalarTypesFromDriver<D extends SqlDriver<Record<string, unknown>>> =
	D extends SqlDriver<infer S> ? S : DefaultSqlScalarTypeMap

/** Configuration for {@link sqlDatabase}: logical schema name (default `public`) plus the runtime {@link SqlDriver} used at {@link CompiledDataBase.connect}. */
export type SqlDatabaseConfig<D extends SqlDriver<Record<string, unknown>> = SqlDriver<Record<string, unknown>>> = {
	defaultSchema?: string
	driver: D
}

/** Scalar map carried on every {@link JsqlDatabaseShape} (`Db["scalarTypes"]`). */
export type ScalarTypesOf<D extends JsqlDatabaseShape> = D["scalarTypes"]

/** Values object matching `:name` slots implied by {@link ExpressionParamsShape}. */
export type ParamRuntimeValues<Params extends ExpressionParamsShape> = {
	[K in keyof Params]: Params[K] extends { ts: infer T } ? T : never
}

export type SqlDatabase<
	DefaultSchema extends string = "public",
	ScalarTypes extends Record<string, unknown> = DefaultSqlScalarTypeMap,
> = {
	defaultSchema: DefaultSchema
	schemas: {}
	scalarTypes: ScalarTypes
}

export function sqlDatabase<const DS extends string | undefined, D extends SqlDriver<Record<string, unknown>>>(
	config: SqlDatabaseConfig<D>,
): DBMigrations<SqlDatabase<DS extends string ? DS : "public", InferScalarTypesFromDriver<D>>> {
	const defaultSchema = config.defaultSchema ?? "public"
	// @ts-expect-error TS2589 — `SqlDatabase` + `InferScalarTypesFromDriver` instantiation depth; asserted shape matches.
	return new DBMigrations(defaultSchema, null, config.driver) as DBMigrations<
		SqlDatabase<DS extends string ? DS : "public", InferScalarTypesFromDriver<D>>
	>
}

export type MigrationExport = {
	readonly path: string
	readonly source: string
}

export function migration<Path extends string>(path: Path) {
	return {
		add<const S extends string>(source: S): MigrationExport & { path: Path; source: S } {
			return {
				path,
				source,
			}
		},
	}
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
export type FlattenedJsqlDatabase<Database> = Database extends JsqlDatabaseShape
	? {
			defaultSchema: Database["defaultSchema"]
			schemas: Database["schemas"] extends infer Schemas
				? {
						[SKey in keyof Schemas as NonIndexKey<SKey>]: Schemas[SKey] extends infer Schema extends
							JsqlSchemaShape
							? {
									sets: Schema["sets"] extends infer Sets
										? {
												[TKey in keyof Sets as NonIndexKey<TKey>]: Sets[TKey] extends infer Table extends
													JsqlTableShape
													? {
															kind: Table["kind"]
															columns: Table["columns"] extends infer Columns
																? {
																		[CK in keyof Columns as NonIndexKey<CK>]: Columns[CK]
																	}
																: never
															column_sql_types: "column_sql_types" extends keyof Table
																? Table["column_sql_types"] extends infer SqlCols
																	? SqlCols extends { [k: string]: string }
																		? [keyof SqlCols] extends [never]
																			? {}
																			: {
																					[SK in keyof SqlCols as NonIndexKey<SK>]: SqlCols[SK]
																				}
																		: {}
																	: {}
																: {}
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
								}
							: never
					}
				: never
		} & { scalarTypes: Database["scalarTypes"] }
	: Database

// use SqlStatementsRecovering instead of SqlStatements to run checks and find errors on syntactically correct sqls, like absent tables

type Migrations = {
	last: Promise<MigrationExport>
	hidden: boolean
	prev: Migrations | null
}

export type ApplyMigrationOptions = {
	/** Exclude from the migration list; use as a last resort for workarounds. */
	hidden?: true
}

export class DBMigrations<Database extends JsqlDatabaseShape | SqlParserError<string>> {
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

	apply<Source extends string>(
		statement: Source,
		options?: ApplyMigrationOptions,
	): DBMigrations<ApplyStatements<Database, Source>[0]>
	apply<Path extends string, Source extends string>(
		statement: Promise<{ default: MigrationExport & { path: Path; source: Source } }>,
		options?: ApplyMigrationOptions,
	): DBMigrations<ApplyStatements<Database, Source>[0]>
	apply(
		statement: string | Promise<{ default: MigrationExport }>,
		options?: ApplyMigrationOptions,
	): DBMigrations<ApplyStatements<Database, string>[0]> {
		return new DBMigrations<Database>(
			this.#defaultSchema,
			{
				last:
					typeof statement === "string"
						? Promise.resolve({ source: statement, path: "" })
						: statement.then(d => d.default),
				hidden: options?.hidden === true,
				prev: this.#migrations,
			},
			this.#driver,
		) as DBMigrations<ApplyStatements<Database, string>[0]>
	}

	getDefaultSchema(): string {
		return this.#defaultSchema
	}

	async #getMigrations() {
		const result: MigrationExport[] = []
		let current = this.#migrations
		while (current) {
			if (!current.hidden) {
				result.push(await current.last)
			}
			current = current.prev
		}
		result.reverse()
		return result
	}

	async compile(): Promise<CompiledDataBase<FlattenedJsqlDatabase<Database>>> {
		const migrations = await this.#getMigrations()
		return new CompiledDataBase<FlattenedJsqlDatabase<Database>>(migrations, this.#defaultSchema, this.#driver)
	}
}

export class CompiledDataBase<Database extends JsqlDatabaseShape | SqlParserError<string>> {
	get $db(): Database {
		return null as unknown as Database
	}

	constructor(
		migrations: readonly MigrationExport[],
		defaultSchema: string,
		readonly driver: SqlDriver<Record<string, unknown>>,
	) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
	}

	/** Uses the {@link SqlDatabaseConfig.driver} passed to {@link sqlDatabase}. */
	connect(): ConnectedDataBase<Database> {
		return new ConnectedDataBase<Database>(this.migrations, this.defaultSchema, this.driver)
	}

	migrations: readonly MigrationExport[]
	defaultSchema: string
}

type SqlSelectRowObject<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Stmt extends string,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	SqlSelectRow<Db, Stmt, Params> extends infer R
		? R extends SqlParserError<string>
			? never
			: { [K in keyof R]: R[K] }
		: never

export class ConnectedDataBase<Database extends JsqlDatabaseShape | SqlParserError<string>> {
	get $db(): Database {
		return null as unknown as Database
	}

	constructor(
		migrations: readonly MigrationExport[],
		defaultSchema: string,
		dbInterface: SqlDriver<Record<string, unknown>>,
	) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
		this.dbInterface = dbInterface
	}

	/**
	 * All rows at once. `Stmt` must be a `SELECT` / `WITH … SELECT` that type-checks against
	 * {@link Database}. With `:name` parameters, pass {@link ParamRuntimeValues} as the second
	 * argument (drivers such as `postgresSqlDriver` bind them to PostgreSQL `$n` placeholders).
	 */
	query<Stmt extends string>(statement: Stmt): Promise<Array<SqlSelectRowObject<Database, Stmt>>>
	query<Stmt extends string, Params extends ExpressionParamsShape>(
		statement: Stmt,
		params: ParamRuntimeValues<Params>,
	): Promise<Array<SqlSelectRowObject<Database, Stmt, Params>>>
	query(statement: string, params?: Record<string, unknown>): Promise<Array<unknown>> {
		return this.dbInterface.query(statement, params) as Promise<Array<unknown>>
	}

	/**
	 * Row-by-row iteration when the driver exposes {@link SqlDriver.stream}; otherwise buffers
	 * {@link query} and yields each row.
	 */
	stream<Stmt extends string>(statement: Stmt): AsyncIterable<SqlSelectRowObject<Database, Stmt>>
	stream<Stmt extends string, Params extends ExpressionParamsShape>(
		statement: Stmt,
		params: ParamRuntimeValues<Params>,
	): AsyncIterable<SqlSelectRowObject<Database, Stmt, Params>>
	stream(statement: string, params?: Record<string, unknown>): AsyncIterable<unknown> {
		const streamFn = this.dbInterface.stream
		if (streamFn !== undefined) {
			return streamFn(statement, params) as AsyncIterable<unknown>
		}
		const db = this.dbInterface
		return (async function* () {
			const rows = await db.query(statement, params)
			for (const row of rows) {
				yield row
			}
		})()
	}

	migrations: readonly MigrationExport[]
	defaultSchema: string
	dbInterface: SqlDriver<Record<string, unknown>>
}
