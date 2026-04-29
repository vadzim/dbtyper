import type { MergeDbPreserveScalars } from "../../core/sql-scalar-types.ts"
import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import { bindColonNamedParamsForPg } from "../postgres/bind-colon-named-params-for-pg.ts"
import type { SqlSelectRow } from "./sql-query.ts"

/**
 * Default SQL scalar identifier spellings (lowercased join of type words) → TypeScript types.
 * Used only as the default second type argument of {@link SqlDatabase} / {@link sqlDatabase}.
 */
export type SqlScalarTypeMap = {
	uuid: string
	text: string
	integer: number
	int: number
	bigint: bigint
	smallint: number
	boolean: boolean
	bool: boolean
	numeric: string
	decimal: string
	real: number
	float: number
	"double precision": number
	json: unknown
	jsonb: unknown
	date: string
	timestamp: Date
	"timestamp with time zone": Date
	"timestamp without time zone": Date
	"time with time zone": string
	"time without time zone": string
	"character varying": string
	varchar: string
	char: string
}

/** Scalar map carried on every {@link JsqlDatabaseShape} (`Db["scalarTypes"]`). */
export type ScalarTypesOf<D extends JsqlDatabaseShape> = D["scalarTypes"]

export type { MergeDbPreserveScalars }

export type SqlDriver = {
	query(sql: string, params?: readonly unknown[]): Promise<Array<unknown>>
	stream?(sql: string, params?: readonly unknown[]): AsyncIterable<unknown>
}

/** Values object matching `:name` slots implied by {@link ExpressionParamsShape}. */
export type ParamRuntimeValues<Params extends ExpressionParamsShape> = {
	[K in keyof Params]: Params[K] extends { ts: infer T } ? T : never
}

export type SqlDatabase<
	DefaultSchema extends string = "public",
	ScalarTypes extends Record<string, unknown> = SqlScalarTypeMap,
> = {
	defaultSchema: DefaultSchema
	schemas: {}
	scalarTypes: ScalarTypes
}

export function sqlDatabase<
	DefaultSchema extends string,
	ScalarTypes extends Record<string, unknown> = SqlScalarTypeMap,
>(defaultSchema: DefaultSchema) {
	return new DBMigrations<SqlDatabase<DefaultSchema, ScalarTypes>>(defaultSchema)
}

export function migration<Path extends string>(path: Path) {
	return {
		add<const S extends string>(source: S): NamedMigration<S, Path> {
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

type NamedMigration<S extends string, Path extends string> = {
	source: S
	path: Path
}

type Migrations = {
	last: Promise<{ source: string; path: string }>
	prev: Migrations | null
}

export class DBMigrations<Database extends JsqlDatabaseShape | SqlParserError<string>> {
	constructor(defaultSchema: string, migrations: Migrations | null = null) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
	}

	#migrations: Migrations | null
	#defaultSchema: string

	// @ts-expect-error TS2589 — `ApplyStatements` depth can exceed the checker limit on large sources; overload is still correct.
	apply<Source extends string>(statement: Source): DBMigrations<ApplyStatements<Database, Source>[0]>
	apply<Path extends string, Source extends string>(
		statement: Promise<{ default: { path: Path; source: Source } }>,
	): DBMigrations<ApplyStatements<Database, Source>[0]>
	apply(
		statement: string | Promise<{ default: { source: string; path: string } }>,
	): DBMigrations<ApplyStatements<Database, string>[0]> {
		return new DBMigrations<Database>(this.#defaultSchema, {
			last:
				typeof statement === "string"
					? Promise.resolve({ source: statement, path: "" })
					: statement.then(d => d.default),
			prev: this.#migrations,
		}) as DBMigrations<ApplyStatements<Database, string>[0]>
	}

	getDefaultSchema(): string {
		return this.#defaultSchema
	}

	async #getMigrations() {
		const result: { source: string; path: string }[] = []
		let current = this.#migrations
		while (current) {
			result.push(await current.last)
			current = current.prev
		}
		result.reverse()
		return result
	}

	async compile(): Promise<CompiledDataBase<FlattenedJsqlDatabase<Database>>> {
		const migrations = await this.#getMigrations()
		return new CompiledDataBase<FlattenedJsqlDatabase<Database>>(migrations, this.#defaultSchema)
	}
}

export class CompiledDataBase<Database extends JsqlDatabaseShape | SqlParserError<string>> {
	get $db(): Database {
		return null as unknown as Database
	}

	constructor(migrations: readonly { source: string; path: string }[], defaultSchema: string) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
	}

	connect(dbInterface: SqlDriver) {
		return new ConnectedDataBase<Database>(this.migrations, this.defaultSchema, dbInterface)
	}

	migrations: readonly { source: string; path: string }[]
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
		migrations: readonly { source: string; path: string }[],
		defaultSchema: string,
		dbInterface: SqlDriver,
	) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
		this.dbInterface = dbInterface
	}

	/**
	 * All rows at once. `Stmt` must be a `SELECT` / `WITH … SELECT` that type-checks against
	 * {@link Database}. With `:name` parameters, pass {@link ParamRuntimeValues} as the second
	 * argument (bound at runtime as PostgreSQL `$n` placeholders).
	 */
	query<Stmt extends string>(statement: Stmt): Promise<Array<SqlSelectRowObject<Database, Stmt>>>
	query<Stmt extends string, Params extends ExpressionParamsShape>(
		statement: Stmt,
		params: ParamRuntimeValues<Params>,
	): Promise<Array<SqlSelectRowObject<Database, Stmt, Params>>>
	query(statement: string, params?: Record<string, unknown>): Promise<Array<unknown>> {
		const bound =
			params === undefined
				? { text: statement, values: [] as unknown[] }
				: bindColonNamedParamsForPg(statement, params)
		const values = bound.values
		return this.dbInterface.query(bound.text, values.length > 0 ? values : undefined) as Promise<Array<unknown>>
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
		const bound =
			params === undefined
				? { text: statement, values: [] as unknown[] }
				: bindColonNamedParamsForPg(statement, params)
		const values = bound.values
		const args = values.length > 0 ? values : undefined
		const streamFn = this.dbInterface.stream
		if (streamFn !== undefined) {
			return streamFn(bound.text, args) as AsyncIterable<unknown>
		}
		const db = this.dbInterface
		return (async function* () {
			const rows = await db.query(bound.text, args)
			for (const row of rows) {
				yield row
			}
		})()
	}

	migrations: readonly { source: string; path: string }[]
	defaultSchema: string
	dbInterface: SqlDriver
}
