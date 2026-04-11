import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	ParseForeignRefMeta,
	ReadConstraintEntryMatch,
	ValidateConstraintRefs,
} from "./sql-constraints-fk.js"
import type {
	ConsumeStatementEnd,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SkipPastFirstTopLevelComma,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type SqlCreateTable<B extends TokensList> =
	PeekToken<B> extends "create"
		? PeekToken<SkipToken<B>> extends "table"
			? FinalizeCreateTableTuple<ParseCreateTableTuple<B>>
			: never
		: never

type FinalizeCreateTableTuple<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer StatementResult, infer StatementRest extends TokensList]
		? SqlCreateTableParsed<StatementResult> extends infer Parsed
			? SqlCreateTableParsedToType<Parsed> extends SqlParseError<infer E2>
				? [SqlParseError<E2>, StatementRest]
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
			: [SqlParseError<"Internal SQL parser error">, StatementRest]
		: [SqlParseError<"Internal SQL parser error">, EmptyTokenList]

export type SqlCreateTableLike = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParseError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
}

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type CreateBodyState<Row, Names extends string, Error, Refs extends ForeignRefMeta> = {
	row: Row
	names: Names
	error: Error
	refs: Refs
}

type RefsWithOptionalFkMeta<RestHead extends TokensList, Refs extends ForeignRefMeta> =
	ParseForeignRefMeta<RestHead> extends [infer Meta extends ForeignRefMeta, infer FkRest extends TokensList]
		? PeekToken<FkRest> extends ""
			? Refs | Meta
			: Refs
		: Refs

type ParseCreateBodyOneCommaSegment<
	Tail extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Matched,
	RestHead extends TokensList,
> = Matched extends false
	? AddColumn<RestHead, Row, Names> extends infer Next extends { row: unknown; names: string; error: unknown }
		? [Next["error"]] extends [never]
			? ParseCreateBody<Tail, Next["row"], Next["names"], MergeError<Error, Next["error"]>, Refs>
			: [CreateBodyState<Row, Names, MergeError<Error, Next["error"]>, Refs>, Tail]
		: [
				CreateBodyState<
					Row,
					Names,
					MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>,
					Refs
				>,
				Tail,
			]
	: ValidateConstraintRefs<RestHead, Names> extends [infer R, infer ValRest extends TokensList]
		? PeekToken<ValRest> extends ""
			? ParseCreateBody<Tail, Row, Names, MergeError<Error, R>, RefsWithOptionalFkMeta<RestHead, Refs>>
			: never
		: never

type ParseCreateBody<
	B extends TokensList,
	Row,
	Names extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
> =
	PeekToken<B> extends ""
		? [CreateBodyState<Row, Names, Error, Refs>, SkipToken<B>]
		: ReadConstraintEntryMatch<B> extends [infer Matched, infer RestHead extends TokensList]
			? ParseCreateBodyOneCommaSegment<SkipPastFirstTopLevelComma<B>, Row, Names, Error, Refs, Matched, RestHead>
			: [
					CreateBodyState<
						Row,
						Names,
						MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>,
						Refs
					>,
					B,
				]

type ParseCreateTableTuple<B extends TokensList> =
	ReadExpectedToken<B, "create", "Unable to parse CREATE TABLE statement"> extends [
		infer CreateResult,
		infer RestCreate extends TokensList,
	]
		? CreateResult extends SqlParseError<string>
			? [CreateResult, RestCreate]
			: ReadExpectedToken<RestCreate, "table", "Unable to parse CREATE TABLE statement"> extends [
						infer TableResult,
						infer RestTable extends TokensList,
				  ]
				? TableResult extends SqlParseError<string>
					? [TableResult, RestTable]
					: ParseCreateTableStatementBody<RestTable>
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]
		: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]

type ParseCreateTableStatementBody<B extends TokensList> =
	ReadOptionalIfNotExists<B> extends [true, infer RestAfterFlag extends TokensList]
		? ParseCreateTableWithFlag<true, RestAfterFlag>
		: ReadOptionalIfNotExists<B> extends [false, infer RestAfterFlag extends TokensList]
			? ParseCreateTableWithFlag<false, RestAfterFlag>
			: ReadOptionalIfNotExists<B> extends [
						infer FlagError extends SqlParseError<string>,
						infer RestAfterFlag extends TokensList,
				  ]
				? [FlagError, RestAfterFlag]
				: [SqlParseError<"Unable to parse CREATE TABLE statement">, B]

type ParseCreateTableWithFlag<IfNotExists extends boolean, B extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<B> extends [
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
				: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
			: [SqlParseError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
		: [SqlParseError<"Expected a CREATE TABLE statement with a table name">, B]

type SqlCreateTableName<Statement> = Statement extends { name: infer Name extends SqlQualifiedIdentifier }
	? Name
	: SqlParseError<"Expected a CREATE TABLE statement with a table name">

type SqlCreateTableParsed<Statement> = Statement extends {
	body: infer Body extends TokensList
}
	? ParseCreateBody<Body, {}, never> extends [
			infer Parsed extends { row: unknown; error: unknown; refs: ForeignRefMeta },
			infer BodyRest extends TokensList,
		]
		? [Parsed["error"]] extends [never]
			? PeekToken<BodyRest> extends ""
				? Parsed
				: SqlParseError<"Unexpected trailing input in CREATE TABLE body">
			: Parsed
		: SqlParseError<"Internal SQL parser error">
	: SqlParseError<"Internal SQL parser error">

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
