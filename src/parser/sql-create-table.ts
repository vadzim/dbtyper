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
	ReadQualifiedIdentifierFromBuffer,
	ReadUntilTopLevelCommaBuffer,
	SqlQualifiedIdentifier,
	StripSqlComments,
} from "./sql-parse-primitives.js"
import type { Buffer, EmptyBuffer, InitBuffer, ReadToken } from "./sql-tokens.js"

export type SqlCreateTable<B extends Buffer> =
	ReadToken<B> extends ["create", infer AfterCreate extends Buffer]
		? ReadToken<AfterCreate> extends ["table", Buffer]
			? FinalizeCreateTableTuple<ParseCreateTableTuple<B>>
			: never
		: never

type FinalizeCreateTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends Buffer]
	? [E, R]
	: T extends [infer StatementResult, infer StatementRest extends Buffer]
		? ConsumeStatementEnd<StatementRest> extends [true, infer Tail extends Buffer]
			? ReadToken<Tail> extends ["", Buffer]
				? SqlCreateTableParsed<StatementResult> extends infer Parsed
					? SqlCreateTableParsedToType<Parsed> extends SqlParseError<infer E2>
						? [SqlParseError<E2>, Tail]
						: [
								{
									readonly kind: "create_table"
									readonly name: SqlCreateTableName<StatementResult>
									// General rule: types are helpers and must not become a bottleneck.
									readonly row: SqlCreateTableParsedToType<Parsed> extends infer Row
										? { [K in keyof Row]: Row[K] }
										: never
									readonly refs: SqlCreateTableParsedRefs<Parsed>
								},
								Tail,
							]
					: [SqlParseError<"Internal SQL parser error">, Tail]
				: [SqlParseError<"Expected CREATE TABLE body in parentheses">, StatementRest]
			: [SqlParseError<"Expected CREATE TABLE body in parentheses">, StatementRest]
		: [SqlParseError<"Internal SQL parser error">, EmptyBuffer]

export type SqlCreateTableLike = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParseError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
}

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type ParseForeignRefMetaFirst<B extends Buffer> =
	ParseForeignRefMeta<B> extends [infer R extends ForeignRefMeta, infer _ extends Buffer] ? R : never

type ParseCreateBody<B extends Buffer, Row, Names extends string, Error = never, Refs extends ForeignRefMeta = never> =
	ReadToken<B> extends ["", Buffer]
		? { row: Row; names: Names; error: Error; refs: Refs }
		: ReadUntilTopLevelCommaBuffer<B> extends [infer Head extends Buffer, infer Tail extends Buffer]
			? IsConstraintEntry<Head> extends [true, infer _ extends Buffer]
				? ParseCreateBody<
						Tail,
						Row,
						Names,
						MergeError<
							Error,
							ValidateConstraintRefs<Head, Names> extends [infer R, infer __ extends Buffer] ? R : never
						>,
						Refs | ParseForeignRefMetaFirst<Head>
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
		? ReadFirstParenGroup<RestAfterName> extends [infer Inner extends Buffer, infer Tail extends Buffer]
			? ConsumeStatementEnd<Tail> extends [true, infer RestTail extends Buffer]
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
	body: infer Body extends Buffer
}
	? Body extends { readonly __buffer__: infer S extends string }
		? ParseCreateBody<InitBuffer<StripSqlComments<S>>, {}, never> extends infer Parsed extends {
			row: unknown
			error: unknown
			refs: ForeignRefMeta
		}
			? Parsed
			: SqlParseError<"Internal SQL parser error">
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
