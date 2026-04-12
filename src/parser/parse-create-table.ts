import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	ParseForeignRefMeta,
	ReadConstraintEntryMatch,
	ValidateConstraintRefs,
} from "./sql-constraints-fk.js"
import type {
	ConsumeStatementEnd,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SkipPastFirstTopLevelComma,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type CreateTableStatement = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParserError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
}

/** `B` must be the buffer immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateTable<B extends TokensList> = FinalizeCreateTableTuple<ParseCreateTableTupleAfterTable<B>>

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

type RefsWithOptionalFkMeta<Kind extends string, AfterKw extends TokensList, Refs extends ForeignRefMeta> =
	ParseForeignRefMeta<Kind, AfterKw> extends [infer Meta extends ForeignRefMeta, infer FkRest extends TokensList]
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
	Kind,
	ColStart extends TokensList,
	AfterKw extends TokensList,
> = [Kind] extends [false]
	? AddColumn<ColStart, Row, Names> extends infer Next extends { row: unknown; names: string; error: unknown }
		? [Next["error"]] extends [never]
			? ParseCreateBody<Tail, Next["row"], Next["names"], MergeError<Error, Next["error"]>, Refs>
			: [CreateBodyState<Row, Names, MergeError<Error, Next["error"]>, Refs>, Tail]
		: [
				CreateBodyState<
					Row,
					Names,
					MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
					Refs
				>,
				Tail,
			]
	: Kind extends string
		? ValidateConstraintRefs<Kind, AfterKw, Names> extends [infer R, infer ValRest extends TokensList]
			? PeekToken<ValRest> extends ""
				? ParseCreateBody<Tail, Row, Names, MergeError<Error, R>, RefsWithOptionalFkMeta<Kind, AfterKw, Refs>>
				: never
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
		: ReadConstraintEntryMatch<B> extends [
					infer Kind,
					infer ColStart extends TokensList,
					infer AfterKw extends TokensList,
			  ]
			? ParseCreateBodyOneCommaSegment<
					SkipPastFirstTopLevelComma<B>,
					Row,
					Names,
					Error,
					Refs,
					Kind,
					ColStart,
					AfterKw
				>
			: [
					CreateBodyState<
						Row,
						Names,
						MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
						Refs
					>,
					B,
				]

type ParseCreateTableTupleAfterTable<B extends TokensList> = ParseCreateTableStatementBody<B>

type ParseCreateTableStatementBody<B extends TokensList> =
	ReadOptionalIfNotExists<B> extends [true, infer RestAfterFlag extends TokensList]
		? ParseCreateTableWithFlag<true, RestAfterFlag>
		: ReadOptionalIfNotExists<B> extends [false, infer RestAfterFlag extends TokensList]
			? ParseCreateTableWithFlag<false, RestAfterFlag>
			: ReadOptionalIfNotExists<B> extends [
						infer FlagError extends SqlParserError<string>,
						infer RestAfterFlag extends TokensList,
				  ]
				? [FlagError, RestAfterFlag]
				: [SqlParserError<"Unable to parse CREATE TABLE statement">, B]

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
				: [SqlParserError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
			: [SqlParserError<"Expected CREATE TABLE body in parentheses">, RestAfterName]
		: [SqlParserError<"Expected a CREATE TABLE statement with a table name">, B]

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
			? PeekToken<BodyRest> extends ""
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
