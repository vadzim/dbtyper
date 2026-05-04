import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "./jsql-shapes.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { PostgresTypeMap } from "../postgres/postgres-type-map.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { SqlSelectRow } from "../../test/test-utils/parser-test-utils.ts"

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
	ScalarTypes extends Record<string, unknown> = DefaultSqlScalarTypeMap,
	Functions extends Record<string, string> = Record<string, never>,
> = {
	defaultSchema: DefaultSchema
	schemas: {}
	scalarTypes: ScalarTypes
	functions?: Functions
}

export interface SqlMigrations<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	ScalarTypes extends Record<string, unknown>,
> {
	apply<Source extends string>(
		statement: Source extends CheckSqlMigrationSource<Db, Source> ? Source : CheckSqlMigrationSource<Db, Source>,
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
		FlattenedJsqlDatabase<SqlDatabase<DS, InferScalarTypesFromDriver<D>, Record<string, never>>>,
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
export type FlattenedJsqlDatabase<Db> = Db extends JsqlDatabaseShape
	? {
			defaultSchema: Db["defaultSchema"]
			schemas: Db["schemas"] extends infer Schemas
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
		} & Pick<Db, Extract<keyof Db, "functions">>
	: Db

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

type SqlSelectRowObject<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape,
> =
	SqlSelectRow<Db, Stmt, ScalarTypes, Params> extends infer R
		? R extends SqlParserError<string>
			? never
			: { [K in keyof R]: R[K] }
		: never

type CheckSqlValid<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	Stmt extends string,
	ScalarTypes extends Record<string, unknown>,
	Params extends ExpressionParamsShape,
> = [SqlSelectRow<Db, Stmt, ScalarTypes, Params>] extends [SqlParserError<infer Msg>] ? `Error in query: ${Msg}` : Stmt

type CheckSqlMigrationSource<Db extends JsqlDatabaseShape | SqlParserError<string>, Source extends string> =
	ApplyStatements<Db, Source>[1] extends SqlParserError<infer M> ? M : Source

export type DataBase<
	Db extends JsqlDatabaseShape | SqlParserError<string>,
	ScalarTypes extends Record<string, unknown>,
> = {
	/**
	 * All rows at once.
	 */
	query<Stmt extends string>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, ScalarTypes, EmptyExpressionParams>
			? Stmt
			: CheckSqlValid<Db, Stmt, ScalarTypes, EmptyExpressionParams>,
	): Promise<Array<SqlSelectRowObject<Db, Stmt, ScalarTypes, EmptyExpressionParams>>>

	query<Stmt extends string, Params extends ExpressionParamsShape>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, ScalarTypes, Params>
			? Stmt
			: CheckSqlValid<Db, Stmt, ScalarTypes, Params>,
		params: ParamRuntimeValues<Params>,
	): Promise<Array<SqlSelectRowObject<Db, Stmt, ScalarTypes, Params>>>

	queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<any>>

	/**
	 * Row-by-row iteration
	 */
	stream<Stmt extends string>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, ScalarTypes, EmptyExpressionParams>
			? Stmt
			: CheckSqlValid<Db, Stmt, ScalarTypes, EmptyExpressionParams>,
	): AsyncIterable<SqlSelectRowObject<Db, Stmt, ScalarTypes, EmptyExpressionParams>>

	stream<Stmt extends string, Params extends ExpressionParamsShape>(
		statement: Stmt extends CheckSqlValid<Db, Stmt, ScalarTypes, Params>
			? Stmt
			: CheckSqlValid<Db, Stmt, ScalarTypes, Params>,
		params: ParamRuntimeValues<Params>,
	): AsyncIterable<SqlSelectRowObject<Db, Stmt, ScalarTypes, Params>>

	streamUntyped(statement: string, params?: Record<string, unknown>): AsyncIterable<any>

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

	stream(statement: string, params?: Record<string, unknown>): AsyncIterable<unknown> {
		const streamFn = this.dbInterface.stream
		if (streamFn !== undefined) {
			return streamFn(statement, params)
		}
		const db = this.dbInterface
		return (async function* () {
			const rows = await db.query(statement, params)
			for (const row of rows) {
				yield row
			}
		})()
	}

	queryUntyped(statement: string, params?: Record<string, unknown>): Promise<Array<unknown>> {
		return this.query(statement, params)
	}

	streamUntyped(statement: string, params?: Record<string, unknown>): AsyncIterable<unknown> {
		return this.stream(statement, params)
	}

	migrations: readonly MigrationExport[]
	defaultSchema: string
	dbInterface: SqlDriver<Record<string, unknown>>
}

/** Default `scalarTypes` for {@link SqlDatabase} / {@link sqlMigrations}; same keys as {@link PostgresTypeMap}. */
type DefaultSqlScalarTypeMap = PostgresTypeMap

/** Scalar map inferred from {@link SqlDriver}'s type parameter; used by {@link sqlMigrations}. */
type InferScalarTypesFromDriver<D extends SqlDriver<Record<string, unknown>>> =
	D extends SqlDriver<infer S> ? S : DefaultSqlScalarTypeMap
