import { dirname, sep } from "node:path"
import { fileURLToPath } from "node:url"

import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlDataShape } from "./jsql-shapes.ts"
import type { EmptyExpressionParams } from "../parser/parse-expression.ts"
import type { ApplyStatements } from "../parser/parse-sql-statement.ts"
import type { ParserSyntaxOf } from "./dialect.ts"
import type {
	DriverConfig,
	DriverConfigDraft,
	GetDriverConfig,
	ParamsDriverConfig,
	RequireDriverDialect,
	SqlDriver,
} from "./sql-driver.ts"
import { STREAM_REQUIRES_ROWS_MESSAGE } from "./stream-requires-rows.ts"
import type { CheckSqlValid } from "./sql-query-types.ts"
import type { DataBase, InitialDatabase, SqlDatabaseConfig } from "./sql-database.ts"

export interface SqlMigrations<Db extends JsqlDatabaseShape, Config extends DriverConfig> {
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

export type MigrationExport = {
	source: string
	path: string
}

const DBTYPER_DIR = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * RUN-4: the file of the first stack frame outside dbtyper (its `src/` or `dist/` folder). Reads frames with and
 * without parentheses (`at f (file:///a.mjs:1:2)`, `at /a.js:1:2`, `at async f (...)`), file URLs and plain paths,
 * any extension; skips `node:` internals. Returns undefined when no such frame exists.
 */
export function migrationCallerFile(stack: string, ownDir: string = DBTYPER_DIR): string | undefined {
	for (const line of stack.split("\n")) {
		const match = /^\s*at (?:.*? \()?(.*?):\d+:\d+\)?\s*$/.exec(line)
		if (match === null) {
			continue
		}
		let file = match[1]!
		if (file.startsWith("node:")) {
			continue
		}
		if (file.startsWith("file://")) {
			try {
				file = fileURLToPath(file)
			} catch {
				continue
			}
		}
		if (file.startsWith(ownDir + sep)) {
			continue
		}
		return file
	}
	return undefined
}

export function migration<S extends string>(source: S): S {
	if (process.env.TEST_MIGRATIONS) {
		const caller = migrationCallerFile(new Error().stack ?? "")
		if (caller !== undefined && !/\.[mc]?js$/.test(caller)) {
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
	schemas: Db["schemas"] extends infer Schemas
		? {
				[SKey in keyof Schemas as NonIndexKey<SKey>]: Schemas[SKey] extends infer Schema extends JsqlSchemaShape
					? {
							sets: Schema["sets"] extends infer Sets
								? {
										[
											TKey in keyof Sets as NonIndexKey<TKey>
										]: Sets[TKey] extends infer Table extends JsqlDataShape
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
																	[
																		FK in keyof ColumnFacts as NonIndexKey<FK>
																	]: ColumnFacts[FK]
																}
														: never
													constraints: Table["constraints"] extends infer Constraints
														? [keyof Constraints] extends [never]
															? {}
															: {
																	[
																		CKe in keyof Constraints as NonIndexKey<CKe>
																	]: Constraints[CKe]
																}
														: never
												} & (Table extends { rowid_table: true } ? { rowid_table: true } : {}) &
													(Table extends { rowid_alias: infer A extends string }
														? { rowid_alias: A }
														: {}) &
													// #150, #151: declaration order and SQLite spellings
													(Table extends { order: infer O } ? { order: O } : {}) &
													(Table extends { spelled: infer Sp } ? { spelled: Sp } : {})
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
		const db = this.dbInterface

		if (db.stream !== undefined) {
			return await db.stream(statement, params)
		}

		const rows = await db.query(statement, params)

		if (!Array.isArray(rows)) {
			throw new Error(STREAM_REQUIRES_ROWS_MESSAGE)
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
