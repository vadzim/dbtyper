import type { SqlStatementsRecovering } from "../parser/sql-parse-statement.js"
import type { ParseSqlTokens, SqlParseError } from "../parser/sql-tokens.js"
import type { SqlDatabaseLike, SqlDatabase } from "./sql-database.js"
import type { SqlApplyStatements, SqlStatementLike } from "./apply-statement.js"

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

// use SqlStatementsRecovering instead of SqlStatements to run checks and find errors on syntactically correct sqls, like absent tables
type UnnamedMigration<S extends string> = S & { readonly __sql_parsed__: SqlStatementsRecovering<ParseSqlTokens<S>>[0] }

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

	apply<Parsed extends readonly SqlStatementLike[]>(
		statement: string & { readonly __sql_parsed__: Parsed },
	): DBMigrations<SqlApplyStatements<Database, Parsed>>
	apply<Parsed extends readonly SqlStatementLike[]>(
		statement: Promise<{ default: { path: string; source: string & { readonly __sql_parsed__: Parsed } } }>,
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
