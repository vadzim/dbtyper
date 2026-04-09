import type { SqlStatement } from "../parser/sql-parse-statement.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"
import type { SqlDatabaseLike, SqlEmptyDatabase } from "./sql-database.js"
import type { SqlApplyStatement } from "./sql-apply-statement.js"

type SqlStatementString<S extends string> = S & { readonly __sql_parsed__: SqlStatement<S> }

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

	apply<S extends string & { readonly __sql_parsed__: SqlStatement<string> }>(statement: S) {
		return new DBMigrations<SqlApplyStatement<Database, S["__sql_parsed__"]>>(this.#defaultSchema, {
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

const y = sqlStatement("create table users (id int primary key)")
const x = sqlDatabase("public").apply(sqlStatement("create table users (id int primary key)"))
