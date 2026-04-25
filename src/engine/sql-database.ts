import type { ParseSqlStatementsRecovering } from "../parser/parse-sql-statement.ts"
import type { ParseSqlTokens, SqlParserError, TokensList } from "../../core/sql-tokens.ts"
import type { JsqlColumnFactsEntry, JsqlConstraintEntry } from "./table-constraint-meta.ts"
import type { SqlApplyStatements, SqlStatement } from "./apply-statement.ts"

export function sqlDatabase<DefaultSchema extends string>(defaultSchema: DefaultSchema) {
	return new DBMigrations<SqlDatabase<DefaultSchema>>(defaultSchema)
}

export function sqlStatement<S extends string>(source: S) {
	return source as MigrationText<S>
}

export function migration<Path extends string>(path: Path) {
	return {
		add<const S extends string>(source: S): NamedMigration<S, Path> {
			return {
				path,
				source: source as MigrationText<S>,
			}
		},
	}
}

export type SqlDatabase<DefaultSchema extends string = "public"> = {
	defaultSchema: DefaultSchema
	schemas: {}
}

export type SqlTableLike = {
	columns: { [K: string]: unknown }
	constraints?: { [K: string]: JsqlConstraintEntry }
	column_facts?: { [K: string]: JsqlColumnFactsEntry }
}

export type SqlSchemaLike = {
	tables: { [K: string]: SqlTableLike }
}

export type SqlDatabaseLike = {
	defaultSchema: string
	schemas: { [K: string]: SqlSchemaLike }
}

export type SimplifyDeep<T> = T extends (...args: never[]) => unknown
	? T
	: T extends Date
		? T
		: T extends readonly unknown[]
			? { [K in keyof T]: SimplifyDeep<T[K]> }
			: T extends object
				? { [K in keyof T]: SimplifyDeep<T[K]> }
				: T

// use SqlStatementsRecovering instead of SqlStatements to run checks and find errors on syntactically correct sqls, like absent tables
type MigrationText<S extends string> = S & {
	parsedSql: ParseSqlStatementsRecovering<ParseSqlTokens<S>> extends [infer _Rest extends TokensList, infer Parsed]
		? Parsed
		: never
}

type NamedMigration<S extends string, Path extends string> = {
	source: MigrationText<S>
	path: Path
}

type Migrations = {
	last: Promise<{ source: string; path: string }>
	prev: Migrations | null
}

export class DBMigrations<Database extends SqlDatabaseLike | SqlParserError<string>> {
	constructor(defaultSchema: string, migrations: Migrations | null = null) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
	}

	#migrations: Migrations | null
	#defaultSchema: string

	apply<Parsed extends SqlStatement[]>(
		statement: string & { parsedSql: Parsed },
	): DBMigrations<SqlApplyStatements<Database, Parsed>>
	apply<Parsed extends SqlStatement[]>(
		statement: Promise<{ default: { path: string; source: string & { parsedSql: Parsed } } }>,
	): DBMigrations<SqlApplyStatements<Database, Parsed>>
	apply(statement: string | Promise<{ default: { source: string; path: string } }>) {
		return new DBMigrations(this.#defaultSchema, {
			last:
				typeof statement === "string"
					? Promise.resolve({ source: statement, path: "" })
					: statement.then(d => d.default),
			prev: this.#migrations,
		})
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
		return new CompiledDataBase<Database>(migrations, this.#defaultSchema)
	}
}

export class CompiledDataBase<Database> {
	get $db(): Database {
		return null as unknown as Database
	}

	constructor(migrations: readonly { source: string; path: string }[], defaultSchema: string) {
		this.migrations = migrations
		this.defaultSchema = defaultSchema
	}

	migrations: readonly { source: string; path: string }[]
	defaultSchema: string
}
