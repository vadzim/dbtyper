import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	ParseConstraintEntry,
	ReadConstraintEntryMatch,
} from "./sql-constraints-fk.js"
import type {
	ConsumeStatementEnd,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { SkipStatement, SkippedStatement } from "./skip-statement.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type CreateTableStatement = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParserError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
}

/** `Tokens` must be the buffer immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateTable<Tokens extends TokensList> = FinalizeCreateTableTuple<
	ParseCreateTableTupleAfterTable<Tokens>
>

type FinalizeCreateTableTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer StatementResult, infer StatementRest extends TokensList]
		? SqlCreateTableParsed<StatementResult> extends infer Parsed
			? SqlCreateTableParsedToType<Parsed> extends SqlParserError<infer E2>
				? [SqlParserError<E2>, StatementRest]
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
						StatementRest,
					]
			: [SqlParserError<"Internal SQL parser error">, StatementRest]
		: [SqlParserError<"Internal SQL parser error">, EmptyTokenList]

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type CreateBodyState<Row, Names extends string, Error, Refs extends ForeignRefMeta> = {
	row: Row
	names: Names
	error: Error
	refs: Refs
}

type ParseCreateBody<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> =
	PeekToken<Tokens> extends ""
		? [CreateBodyState<Row, Names, Error, Refs>, Tokens]
		: ReadConstraintEntryMatch<Tokens> extends [infer Kind, infer AfterKw extends TokensList]
			? ParseCreateBodyEntry<Tokens, Kind, AfterKw, Row, Names, Error, Refs>
			: [
					CreateBodyState<
						Row,
						Names,
						MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
						Refs
					>,
					Tokens,
				]

/** Dispatches on `Kind` (a named type-parameter so TypeScript can narrow it via `[Kind] extends [false]`). */
type ParseCreateBodyEntry<
	Tokens extends TokensList,
	Kind,
	AfterKw extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
> = [Kind] extends [false]
	? ParseCreateBodyColumn<Tokens, Row, Names, Error, Refs>
	: Kind extends string
		? ParseCreateBodyConstraint<Kind, AfterKw, Row, Names, Error, Refs>
		: [
				CreateBodyState<
					Row,
					Names,
					MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
					Refs
				>,
				Tokens,
			]

type ParseCreateBodyColumn<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
> = AddColumn<Tokens, Row, Names> extends infer Added extends {
	row: unknown
	names: string
	error: unknown
	rest: TokensList
}
	? [Added["error"]] extends [never]
		? SkipStatement<Added["rest"], "," | ")" | ""> extends [SkippedStatement<infer EndTk>, infer NextTail extends TokensList]
			? EndTk extends ","
				? ParseCreateBody<NextTail, Added["row"], Added["names"], Error, Refs>
				: [CreateBodyState<Added["row"], Added["names"], Error, Refs>, NextTail]
			: [CreateBodyState<Added["row"], Added["names"], Error, Refs>, Added["rest"]]
		: [CreateBodyState<Row, Names, MergeError<Error, Added["error"]>, Refs>, Added["rest"]]
	: [CreateBodyState<Row, Names, MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>, Refs>, Tokens]

type ParseCreateBodyConstraint<
	Kind extends string,
	AfterKw extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
> = ParseConstraintEntry<Kind, AfterKw, Names> extends [infer EntryResult, infer BodyRest extends TokensList]
	? SkipStatement<BodyRest, "," | ")" | ""> extends [SkippedStatement<infer EndTk>, infer NextTail extends TokensList]
		? EntryResult extends SqlParserError<string>
			? EndTk extends ","
				? ParseCreateBody<NextTail, Row, Names, MergeError<Error, EntryResult>, Refs>
				: [CreateBodyState<Row, Names, MergeError<Error, EntryResult>, Refs>, NextTail]
			: EndTk extends ","
				? ParseCreateBody<NextTail, Row, Names, Error, Refs | (EntryResult extends ForeignRefMeta ? EntryResult : never)>
				: [CreateBodyState<Row, Names, Error, Refs | (EntryResult extends ForeignRefMeta ? EntryResult : never)>, NextTail]
		: [CreateBodyState<Row, Names, MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>, Refs>, BodyRest]
	: [CreateBodyState<Row, Names, MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>, Refs>, AfterKw]

type ParseCreateTableTupleAfterTable<Tokens extends TokensList> = ParseCreateTableStatementBody<Tokens>

type ParseCreateTableStatementBody<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [true, infer RestAfterFlag extends TokensList]
		? ParseCreateTableWithFlag<true, RestAfterFlag>
		: ReadOptionalIfNotExists<Tokens> extends [false, infer RestAfterFlag extends TokensList]
			? ParseCreateTableWithFlag<false, RestAfterFlag>
			: ReadOptionalIfNotExists<Tokens> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestAfterFlag extends TokensList,
				  ]
				? [FlagError, RestAfterFlag]
				: [SqlParserError<"Unable to parse CREATE TABLE statement">, Tokens]

type ParseCreateTableWithFlag<IfNotExists extends boolean, Tokens extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [
		infer Name extends SqlQualifiedIdentifier,
		infer RestAfterName extends TokensList,
	]
		? ReadFirstParenGroup<RestAfterName> extends [infer Inner extends TokensList, infer Tail extends TokensList]
			? ConsumeStatementEnd<Tail> extends [true, infer RestTail extends TokensList]
				? [
						{
							name: Name
							ifNotExists: IfNotExists
							body: Inner
						},
						RestTail,
					]
				: [SqlParserError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
			: [SqlParserError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
		: [SqlParserError<"Expected a CREATE TABLE statement with a table name">, Tokens]

type SqlCreateTableName<Statement> = Statement extends { name: infer Name extends SqlQualifiedIdentifier }
	? Name
	: SqlParserError<"Expected a CREATE TABLE statement with a table name">

type SqlCreateTableParsed<Statement> = Statement extends {
	body: infer Body extends TokensList
}
	? ParseCreateBody<Body, {}, never> extends [
			infer Parsed extends { row: unknown; error: unknown; refs: ForeignRefMeta },
			infer BodyRest extends TokensList,
		]
		? [Parsed["error"]] extends [never]
			? PeekToken<BodyRest> extends "" | ";"
				? Parsed
				: SqlParserError<"Unexpected trailing input in CREATE TABLE body">
			: Parsed
		: SqlParserError<"Internal SQL parser error">
	: SqlParserError<"Internal SQL parser error">

type SqlCreateTableParsedToType<Parsed> =
	Parsed extends SqlParserError<infer E>
		? SqlParserError<E>
		: Parsed extends { row: unknown; error: unknown }
			? [Parsed["error"]] extends [never]
				? Parsed["row"]
				: Parsed["error"]
			: SqlParserError<"Internal SQL parser error">

type SqlCreateTableParsedRefs<Parsed> = Parsed extends { refs: infer Refs }
	? [Refs] extends [never]
		? undefined
		: Extract<Refs, ForeignRefMeta>
	: undefined
