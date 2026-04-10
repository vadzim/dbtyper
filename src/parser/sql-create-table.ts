import type { SqlParseError } from "./sql-parse-error.js"
import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	IsConstraintEntry,
	ParseForeignRefMeta,
	ValidateConstraintRefs,
} from "./sql-constraints-fk.js"
import type {
	BufferToString,
	ConsumeStatementEnd,
	InitParseBuffer,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
	ReadUntilTopLevelComma,
	StripSqlComments,
	Trim,
} from "./sql-parse-primitives.js"
import type { Buffer, ReadToken } from "./sql-tokens.js"

export type SqlCreateTable<S extends string> =
	ReadToken<InitParseBuffer<S>> extends ["create", infer AfterCreate extends Buffer]
		? ReadToken<AfterCreate> extends ["table", Buffer]
			? FinalizeCreateTable<ParseCreateTableTuple<InitParseBuffer<S>>>
			: never
		: never

type FinalizeCreateTable<T> = T extends [infer E extends SqlParseError<string>, Buffer]
	? E
	: T extends [infer StatementResult, infer StatementRest extends Buffer]
		? ConsumeStatementEnd<StatementRest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
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

type ParseCreateTableTuple<B extends Buffer> =
	ReadExpectedToken<B, "create", "Unable to parse CREATE TABLE statement"> extends [
		infer CreateResult,
		infer RestCreate extends Buffer,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "table", "Unable to parse CREATE TABLE statement"> extends [
					infer TableResult,
					infer RestTable extends Buffer,
				]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ParseCreateTableStatementBody<RestTable>
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]
		: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]

type ParseCreateTableStatementBody<B extends Buffer> =
	ReadOptionalIfNotExists<B> extends [true, infer RestAfterFlag extends Buffer]
		? ParseCreateTableWithFlag<true, RestAfterFlag>
		: ReadOptionalIfNotExists<B> extends [false, infer RestAfterFlag extends Buffer]
			? ParseCreateTableWithFlag<false, RestAfterFlag>
			: ReadOptionalIfNotExists<B> extends [
					  infer FlagError extends SqlParseError<string>,
					  infer RestAfterFlag extends Buffer,
				  ]
				? [FlagError, RestAfterFlag]
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]

type ParseCreateTableWithFlag<IfNotExists extends boolean, B extends Buffer> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestAfterName extends Buffer,
	]
		? ReadFirstParenGroup<Trim<BufferToString<RestAfterName>>> extends [
				infer Inner extends string,
				infer Tail extends string,
			]
			? ConsumeStatementEnd<InitParseBuffer<Tail>> extends [true, infer RestTail extends Buffer]
				? [
						{
							name: Name
							ifNotExists: IfNotExists
							body: Inner
						},
						RestTail,
					]
				: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
			: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
		: [SqlParseError<"Expected a CREATE TABLE statement with a table name">, B]

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
