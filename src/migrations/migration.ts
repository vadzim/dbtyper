import type { SqlParseError } from "../sql-parse-error.js"

export type SqlMigration<Path extends string, Sql extends string> = {
	readonly kind: "migration"
	readonly path: Path
	readonly sql: Sql
}

export function migration<Path extends string>(path: Path) {
	return function <S extends string>(sql: S): SqlMigration<Path, S> {
		return {
			kind: "migration",
			path,
			sql,
		}
	}
}

export type SqlMigrationError<Message extends string> = SqlParseError<Message>
