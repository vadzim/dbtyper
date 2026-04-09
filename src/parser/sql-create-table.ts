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

/**
 * When the table name parses but the body fails, the type is `SqlParseError<…>` (not an object with `row: SqlParseError`).
 * If the name fails, this stays an object so both `name` and `row` errors remain visible.
 */
export type SqlCreateTable<S extends string> =
	SqlCreateTableName<S> extends SqlParseError<string>
		? SqlCreateTableObject<S>
		: SqlCreateTableToType<S> extends SqlParseError<infer E>
			? SqlParseError<E>
			: SqlCreateTableObject<S>

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

type ExtractCreateTableNameInternal<S extends string> = ParseCreateTableTarget<S>
type ExtractCreateBody<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
		? StripLeadingIfNotExists<Rest> extends `${string}(${infer Inner})`
			? Inner
			: never
		: never

type ParseCreateTableTarget<S extends string> =
	ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
		? ReadQualifiedIdentifier<StripLeadingIfNotExists<Rest>> extends [infer Name extends string, string]
			? Name
			: never
			: never

type SqlCreateTableName<S extends string> = [ExtractCreateTableNameInternal<S>] extends [never]
	? SqlParseError<"Expected a CREATE TABLE statement with a table name">
	: ExtractCreateTableNameInternal<S>

type SqlCreateTableToType<S extends string> = [ExtractCreateBody<S>] extends [never]
	? SqlParseError<"Expected a CREATE TABLE statement">
	: ParseCreateBody<ExtractCreateBody<S>, {}, never> extends infer Parsed extends { row: unknown; error: unknown }
		? [Parsed["error"]] extends [never]
			? // Inline mapped expansion is intentional for API/tooling: IDE shows concrete row shape instead of helper alias.
				{ [K in keyof Parsed["row"]]: Parsed["row"][K] }
			: Parsed["error"]
		: SqlParseError<"Internal SQL parser error">

type SqlCreateTableForeignRefs<S extends string> = [ExtractCreateBody<S>] extends [never]
	? never
	: ParseCreateBody<ExtractCreateBody<S>, {}, never> extends infer Parsed extends { refs: ForeignRefMeta }
		? Parsed["refs"]
		: never

/** Valid name + body: full create-table object. */
type SqlCreateTableObject<S extends string> = {
	readonly kind: "create_table"
	readonly name: SqlCreateTableName<S>
	// General rule: types are helpers and must not become a bottleneck.
	readonly row: SqlCreateTableToType<S> extends infer Row
		? // Inline mapped expansion is intentional for API/tooling: keep `SqlCreateTable["row"]` fully expanded in editor hovers.
			{ [K in keyof Row]: Row[K] }
		: never
	readonly source: S
	readonly __refs: SqlCreateTableForeignRefs<S>
}
