import type { SqlParseError } from "../sql-parse-error.js"
import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	IsConstraintEntry,
	ParseForeignRefMeta,
	ValidateConstraintRefs,
} from "./sql-constraints-fk.js"
import type {
	NormalizeSql,
	ReadQualifiedIdentifier,
	ReadUntilTopLevelComma,
	StripLeadingIfNotExists,
	ToLower,
	Trim,
} from "./sql-parse-primitives.js"

export type SqlCreateTable<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table ${infer Body extends string}`
		? ParseCreateTableStatement<Body> extends infer Statement
			? Statement extends SqlParseError<infer E>
				? SqlParseError<E>
				: SqlCreateTableParsed<Statement> extends infer Parsed
					? SqlCreateTableParsedToType<Parsed> extends SqlParseError<infer E>
						? SqlParseError<E>
						: {
								readonly kind: "create_table"
								readonly name: SqlCreateTableName<Statement>
								// General rule: types are helpers and must not become a bottleneck.
								readonly row: SqlCreateTableParsedToType<Parsed> extends infer Row
									? // Inline mapped expansion is intentional for API/tooling: keep `SqlCreateTable["row"]` fully expanded in editor hovers.
										{ [K in keyof Row]: Row[K] }
									: never
								readonly source: S
								readonly __refs: SqlCreateTableParsedRefs<Parsed>
							}
					: SqlParseError<"Internal SQL parser error">
			: SqlParseError<"Internal SQL parser error">
		: never

export type SqlCreateTableLike = {
	readonly kind: "create_table"
	readonly name: string | SqlParseError<string>
	readonly row: unknown
	readonly source: string
	readonly __refs: ForeignRefMeta
}

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type ParseCreateBody<S extends string, Row, Names extends string, Error = never, Refs extends ForeignRefMeta = never> =
	Trim<S> extends ""
		? { row: Row; names: Names; error: Error; refs: Refs }
		: ReadUntilTopLevelComma<S> extends [infer Head extends string, infer Tail extends string]
			? IsConstraintEntry<Head> extends true
				? ParseCreateBody<
						Tail,
						Row,
						Names,
						MergeError<Error, ValidateConstraintRefs<Head, Names>>,
						Refs | ParseForeignRefMeta<Head>
					>
				: AddColumn<Head, Row, Names> extends infer Next extends { row: unknown; names: string; error: unknown }
					? ParseCreateBody<Tail, Next["row"], Next["names"], MergeError<Error, Next["error"]>, Refs>
					: {
							row: Row
							names: Names
							error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>
							refs: Refs
						}
			: {
					row: Row
					names: Names
					error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>
					refs: Refs
				}

type ParseCreateTableStatement<Body extends string> =
	StripLeadingIfNotExists<Body> extends [infer IfNotExists extends boolean, infer RestAfterFlag extends string]
		? ReadQualifiedIdentifier<RestAfterFlag> extends [infer Name extends string, infer RestAfterName extends string]
			? Trim<RestAfterName> extends `(${infer Inner})`
				? {
						name: Name
						ifNotExists: IfNotExists
						body: Inner
					}
				: SqlParseError<"Expected CREATE TABLE body in parentheses">
			: SqlParseError<"Expected a CREATE TABLE statement with a table name">
		: SqlParseError<"Unable to parse CREATE TABLE statement">

type SqlCreateTableName<Statement> = Statement extends { name: infer Name extends string }
	? Name
	: SqlParseError<"Expected a CREATE TABLE statement with a table name">

type SqlCreateTableParsed<Statement> = Statement extends {
	body: infer Body extends string
}
	? ParseCreateBody<Body, {}, never> extends infer Parsed extends {
			row: unknown
			error: unknown
			refs: ForeignRefMeta
		}
		? Parsed
		: SqlParseError<"Internal SQL parser error">
	: SqlParseError<"Expected a CREATE TABLE statement">

type SqlCreateTableParsedToType<Parsed> =
	Parsed extends SqlParseError<infer E>
		? SqlParseError<E>
		: Parsed extends { row: unknown; error: unknown }
			? [Parsed["error"]] extends [never]
				? // Inline mapped expansion is intentional for API/tooling: IDE shows concrete row shape instead of helper alias.
					{ [K in keyof Parsed["row"]]: Parsed["row"][K] }
				: Parsed["error"]
			: SqlParseError<"Internal SQL parser error">

type SqlCreateTableParsedRefs<Parsed> = Parsed extends { refs: ForeignRefMeta } ? Parsed["refs"] : never
