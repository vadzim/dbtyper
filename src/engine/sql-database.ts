import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type { SqlParserError } from "../../core/sql-tokens.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"

export type SqlDriver = {
	query(sql: string): Promise<Array<unknown>>
	stream?(sql: string): AsyncIterable<unknown>
}

export function sqlDatabase<DefaultSchema extends string>(defaultSchema: DefaultSchema) {
	return new DBMigrations<SqlDatabase<DefaultSchema>>(defaultSchema)
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

export type SqlDatabase<DefaultSchema extends string = "public"> = {
	defaultSchema: DefaultSchema
	schemas: {}
}

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

	apply<Source extends string>(statement: Source): DBMigrations<ApplyStatements<Database, Source>>
	apply<Path extends string, Source extends string>(
		statement: Promise<{ default: { path: Path; source: Source } }>,
	): DBMigrations<ApplyStatements<Database, Source>>
	apply(
		statement: string | Promise<{ default: { source: string; path: string } }>,
	): DBMigrations<ApplyStatements<Database, string>> {
		return new DBMigrations<Database>(this.#defaultSchema, {
			last:
				typeof statement === "string"
					? Promise.resolve({ source: statement, path: "" })
					: statement.then(d => d.default),
			prev: this.#migrations,
		}) as DBMigrations<ApplyStatements<Database, string>>
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

	async compile() {
		const migrations = await this.#getMigrations()

		// This type is needed to see Database type in the IDE hint in an unwrapped form.
		// Please never remove it, update it if needed.
		type DatabaseFlattenedType = Database extends JsqlDatabaseShape
			? {
					defaultSchema: Database["defaultSchema"]
					schemas: Database["schemas"] extends infer Schemas
						? {
								[K in keyof Schemas]: Schemas[K] extends infer Schema extends JsqlSchemaShape
									? {
											sets: Schema["sets"] extends infer Sets
												? {
														[K in keyof Sets]: Sets[K] extends infer Table extends JsqlTableShape
															? {
																	kind: Table["kind"]
																	columns: Table["columns"] extends infer Columns
																		? {
																				[K in keyof Columns]: Columns[K]
																			}
																		: never
																	column_sql_types: "column_sql_types" extends keyof Table
																		? Table["column_sql_types"] extends infer SqlCols
																			? SqlCols extends { [k: string]: string }
																				? [keyof SqlCols] extends [never]
																					? {}
																					: {
																							[K in keyof SqlCols]: SqlCols[K]
																						}
																				: {}
																			: {}
																		: {}
																	column_facts: Table["column_facts"] extends infer ColumnFacts
																		? [keyof ColumnFacts] extends [never]
																			? {}
																			: {
																					[K in keyof ColumnFacts]: ColumnFacts[K]
																				}
																		: never
																	constraints: Table["constraints"] extends infer Constraints
																		? [keyof Constraints] extends [never]
																			? {}
																			: {
																					[K in keyof Constraints]: Constraints[K]
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
				}
			: Database

		return new CompiledDataBase<DatabaseFlattenedType>(migrations, this.#defaultSchema)
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

	// query<Stmt extends string>(statement: Stmt) {
	// 	return this.dbInterface.query(statement) as Promise<
	// 		Array<SqlApplyQueryText<Database, Stmt> extends infer R ? { [K in keyof R]: R[K] } : never>
	// 	>
	// }

	// stream<Stmt extends string>(statement: Stmt) {
	// 	return this.dbInterface.stream
	// 		? (this.dbInterface.stream(statement) as AsyncIterable<
	// 				SqlApplyQueryText<Database, Stmt> extends infer R ? { [K in keyof R]: R[K] } : never
	// 			>)
	// 		: async(this.query(statement))
	// }

	migrations: readonly { source: string; path: string }[]
	defaultSchema: string
	dbInterface: SqlDriver
}

async function* async<T>(items: Promise<Iterable<T>>) {
	yield* await items
}
