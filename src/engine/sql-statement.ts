import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike, SqlEmptyDatabase } from "./sql-database.js"
import type { SqlApplyStatement, SqlStatementLike } from "./sql-apply-statement.js"

export function sqlStatement<S extends string>(source: S) {
	return source as S & { readonly __sql_parsed__: SqlStatement<S> }
}

type Migrations = {
	last: string
	prev: Migrations | null
}

class DBMigrations<Database extends SqlDatabaseLike | SqlParseError<string>> {
	constructor(defaultSchema: string, migrations: Migrations | null = null) {
		this.#migrations = migrations
		this.#defaultSchema = defaultSchema
	}

	#migrations: Migrations | null
	#defaultSchema: string

	apply<Parsed extends SqlStatementLike>(statement: string & { readonly __sql_parsed__: Parsed }) {
		return new DBMigrations<SqlApplyStatement<Database, Parsed>>(this.#defaultSchema, {
			last: statement,
			prev: this.#migrations,
		})
	}

	getDefaultSchema(): string {
		return this.#defaultSchema
	}

	getMigrations(): string[] {
		const result = []
		let current = this.#migrations
		while (current) {
			result.push(current.last)
			current = current.prev
		}
		return result.reverse()
	}
}

export function sqlDatabase<DefaultSchema extends string>(defaultSchema: DefaultSchema) {
	return new DBMigrations<SqlEmptyDatabase<DefaultSchema>>(defaultSchema)
}
