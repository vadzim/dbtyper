import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type { SqlAlterTable } from "../parser/sql-alter-table.js"
import type { SqlDropTable } from "../parser/sql-drop-table.js"
import type { NormalizeSql, SqlQualifiedIdentifier } from "../parser/sql-parse-primitives.js"
import type { ToLower } from "../parser/sql-parse-primitives.js"
import type { SqlParseError } from "../parser/sql-parse-error.js"

export type SqlMigrationParsed<Sql extends string> =
	ToLower<NormalizeSql<Sql>> extends `create table ${string}`
		? SqlCreateTable<NormalizeSql<Sql>> extends infer ParsedCreate
			? ParsedCreate extends SqlParseError<string>
				? ParsedCreate
				: {
						readonly statement: "create_table"
						readonly target: ParsedCreate extends { readonly name: infer Name extends SqlQualifiedIdentifier }
							? Name
							: never
						readonly row: ParsedCreate extends { readonly row: infer Row } ? Row : never
					}
			: SqlParseError<"Unable to parse CREATE TABLE migration">
		: ToLower<NormalizeSql<Sql>> extends `alter table ${string}`
			? SqlAlterTable<NormalizeSql<Sql>> extends infer ParsedAlter
				? ParsedAlter extends SqlParseError<string>
					? ParsedAlter
					: {
							readonly statement: "alter_table"
							readonly target: ParsedAlter extends { readonly target: infer Target extends SqlQualifiedIdentifier }
								? Target
								: never
						}
				: SqlParseError<"Unable to parse ALTER TABLE migration">
			: ToLower<NormalizeSql<Sql>> extends `drop table ${string}`
				? SqlDropTable<NormalizeSql<Sql>> extends infer ParsedDrop
					? ParsedDrop extends SqlParseError<string>
						? ParsedDrop
						: {
								readonly statement: "drop_table"
								readonly target: ParsedDrop extends { readonly target: infer Target extends SqlQualifiedIdentifier }
									? Target
									: never
							}
					: SqlParseError<"Unable to parse DROP TABLE migration">
				: SqlParseError<"Only CREATE TABLE / ALTER TABLE / DROP TABLE migrations are supported for now">

export type SqlMigration<Path extends string, Sql extends string> = {
	readonly kind: "migration"
	readonly path: Path
	readonly sql: Sql
	readonly parsed: SqlMigrationParsed<Sql>
}

export function migration<Path extends string>(path: Path) {
	return function <const S extends string>(sql: S): SqlMigration<Path, S> {
		return {
			kind: "migration",
			path,
			sql,
			parsed: null as unknown as SqlMigrationParsed<S>,
		}
	}
}

export type SqlMigrationError<Message extends string> = SqlParseError<Message>
