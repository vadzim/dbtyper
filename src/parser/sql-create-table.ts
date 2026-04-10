import type { SqlParseError } from "./sql-parse-error.js"
import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	IsConstraintEntry,
	ParseForeignRefMeta,
	ValidateConstraintRefs,
} from "./sql-constraints-fk.js"
import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifier,
	SqlQualifiedIdentifier,
	ReadUntilTopLevelComma,
	StripSqlComments,
	Trim,
} from "./sql-parse-primitives.js"
import type { ReadToken } from "./sql-tokens.js"

export type SqlCreateTable<S extends string> =
	ReadToken<S> extends ["create", infer AfterCreate extends string]
		? ReadToken<AfterCreate> extends ["table", string]
			? FinalizeCreateTable<ParseCreateTableTuple<S>>
			: never
		: never

type FinalizeCreateTable<T> = T extends [infer E extends SqlParseError<string>, string]
	? E
	: T extends [infer StatementResult, infer StatementRest extends string]
		? ConsumeStatementEnd<StatementRest> extends [true, infer Tail extends string]
			? ReadToken<Tail> extends ["", string]
			? SqlCreateTableParsed<StatementResult> extends infer Parsed
				? SqlCreateTableParsedToType<Parsed> extends SqlParseError<infer E2>
					? SqlParseError<E2>
					: {
							readonly kind: "create_table"
							readonly name: SqlCreateTableName<StatementResult>
							// General rule: types are helpers and must not become a bottleneck.
							readonly row: SqlCreateTableParsedToType<Parsed> extends infer Row
								? { [K in keyof Row]: Row[K] }
								: never
							readonly refs: SqlCreateTableParsedRefs<Parsed>
						}
				: SqlParseError<"Internal SQL parser error">
			: SqlParseError<"Expected CREATE TABLE body in parentheses">
			: SqlParseError<"Expected CREATE TABLE body in parentheses">
		: SqlParseError<"Internal SQL parser error">

export type SqlCreateTableLike = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParseError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
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

type ParseCreateTableTuple<S extends string> =
	ReadExpectedToken<S, "create", "Unable to parse CREATE TABLE statement"> extends [
		infer CreateResult,
		infer RestCreate extends string,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "table", "Unable to parse CREATE TABLE statement"> extends [
					infer TableResult,
					infer RestTable extends string,
				]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ParseCreateTableStatementBody<RestTable>
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, S]
		: [SqlParseError<"Unable to parse CREATE TABLE statement">, S]

type ParseCreateTableStatementBody<Body extends string> =
	ReadOptionalIfNotExists<Body> extends [true, infer RestAfterFlag extends string]
		? ParseCreateTableWithFlag<true, RestAfterFlag>
		: ReadOptionalIfNotExists<Body> extends [false, infer RestAfterFlag extends string]
			? ParseCreateTableWithFlag<false, RestAfterFlag>
			: ReadOptionalIfNotExists<Body> extends [
					  infer FlagError extends SqlParseError<string>,
					  infer RestAfterFlag extends string,
				  ]
				? [FlagError, RestAfterFlag]
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, Body]

type ParseCreateTableWithFlag<IfNotExists extends boolean, S extends string> =
	ReadQualifiedIdentifier<S> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestAfterName extends string,
	]
		? ReadFirstParenGroup<Trim<RestAfterName>> extends [infer Inner extends string, infer Tail extends string]
			? ConsumeStatementEnd<Tail> extends [true, infer RestTail extends string]
				? [
						{
							name: Name
							ifNotExists: IfNotExists
							body: Inner
						},
						Trim<RestTail>,
					]
				: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
			: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
		: [SqlParseError<"Expected a CREATE TABLE statement with a table name">, S]

type SqlCreateTableName<Statement> = Statement extends { name: infer Name extends SqlQualifiedIdentifier }
	? Name
	: SqlParseError<"Expected a CREATE TABLE statement with a table name">

type SqlCreateTableParsed<Statement> = Statement extends {
	body: infer Body extends string
}
	? ParseCreateBody<StripSqlComments<Body>, {}, never> extends infer Parsed extends {
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
				? Parsed["row"]
				: Parsed["error"]
			: SqlParseError<"Internal SQL parser error">

type SqlCreateTableParsedRefs<Parsed> = Parsed extends { refs: infer Refs }
	? [Refs] extends [never]
		? undefined
		: Extract<Refs, ForeignRefMeta>
	: undefined
