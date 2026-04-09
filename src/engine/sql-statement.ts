import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike, SqlDatabase } from "./sql-database.js"
import type { SqlApplyStatement, SqlStatementLike } from "./sql-apply-statement.js"

export function sqlDatabase<DefaultSchema extends string>(defaultSchema: DefaultSchema) {
	return new DBMigrations<SqlDatabase<DefaultSchema>>(defaultSchema)
}

export function sqlStatement<S extends string>(source: S) {
	return source as UnnamedMigration<S>
}

export function migration<Path extends string>(path: Path) {
	return {
		add<const S extends string>(source: S): NamedMigration<S, Path> {
			return {
				path,
				source,
			} as NamedMigration<S, Path>
		},
	}
}

type UnnamedMigration<S extends string> = S & { readonly __sql_parsed__: SqlStatement<S> }

type NamedMigration<S extends string, Path extends string> = {
	readonly kind: "migration"
	readonly source: UnnamedMigration<S>
	readonly path: Path
}

export type Migrations = {
	last: Promise<{ source: string; path: string }>
	prev: Migrations | null
}

export class DBMigrations<Database extends SqlDatabaseLike | SqlParseError<string>> {
	constructor(defaultSchema: string, migrations: Migrations | null = null) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
	}

	#migrations: Migrations | null
	#defaultSchema: string

	apply<Parsed extends SqlStatementLike>(
		statement: string & { readonly __sql_parsed__: Parsed },
	): DBMigrations<SqlApplyStatement<Database, Parsed>>
	apply<Parsed extends SqlStatementLike>(
		statement: Promise<{ default: { path: string; source: string & { readonly __sql_parsed__: Parsed } } }>,
	): DBMigrations<SqlApplyStatement<Database, Parsed>>
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

	async getMigrations() {
		const result: { source: string; path: string }[] = []
		let current = this.#migrations
		while (current) {
			result.push(await current.last)
			current = current.prev
		}
		return result.reverse()
	}
}
