import type { SqlCreateTable } from "../parser/sql-create-table.js"
import type {
	ReadIdentifier,
	RemoveTrailingSemicolon,
	StripIdentifierQuotes,
	StripSqlComments,
	ToLower,
	Trim,
} from "../parser/sql-parse-primitives.js"
import type { SqlParseError } from "../sql-parse-error.js"

type NormalizeSql<S extends string> = Trim<RemoveTrailingSemicolon<StripSqlComments<S>>>
type NormalizeCreateForRow<S extends string> =
	NormalizeSql<S> extends `create table if not exists ${infer Rest}` ? `create table ${Rest}` : NormalizeSql<S>

type ReadQualifiedIdentifier<S extends string> =
	ReadIdentifier<Trim<S>> extends [infer A extends string, infer RestA extends string]
		? Trim<RestA> extends `.${infer AfterDot}`
			? ReadIdentifier<AfterDot> extends [infer B extends string, infer RestB extends string]
				? [`${StripIdentifierQuotes<A>}.${StripIdentifierQuotes<B>}`, RestB]
				: [StripIdentifierQuotes<A>, RestA]
			: [StripIdentifierQuotes<A>, RestA]
		: never

type ParseCreateName<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table if not exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseDropTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `drop table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `drop table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

type ParseAlterTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `alter table if exists ${infer Rest}`
		? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
			? Name
			: never
		: ToLower<NormalizeSql<S>> extends `alter table ${infer Rest}`
			? ReadQualifiedIdentifier<Rest> extends [infer Name extends string, string]
				? Name
				: never
			: never

export type SqlMigrationParsed<Sql extends string> =
	ToLower<NormalizeSql<Sql>> extends `create table ${string}`
		? ParseCreateName<Sql> extends infer QName extends string
			? SqlCreateTable<NormalizeCreateForRow<Sql>> extends infer ParsedCreate
				? ParsedCreate extends SqlParseError<string>
					? ParsedCreate
					: {
							readonly statement: "create_table"
							readonly target: QName
							readonly row: ParsedCreate extends { readonly row: infer Row } ? Row : never
						}
				: SqlParseError<"Unable to parse CREATE TABLE migration">
			: SqlParseError<"Unable to parse CREATE TABLE migration target">
		: ToLower<NormalizeSql<Sql>> extends `alter table ${string}`
			? ParseAlterTarget<Sql> extends infer QName extends string
				? {
						readonly statement: "alter_table"
						readonly target: QName
					}
				: SqlParseError<"Unable to parse ALTER TABLE migration target">
			: ToLower<NormalizeSql<Sql>> extends `drop table ${string}`
				? ParseDropTarget<Sql> extends infer QName extends string
					? {
							readonly statement: "drop_table"
							readonly target: QName
						}
					: SqlParseError<"Unable to parse DROP TABLE migration target">
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
