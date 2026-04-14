import type { AddColumn } from "./sql-column.js"
import type {
	ForeignRefMeta,
	IntraTableConstraintRef,
	ParseConstraintBody,
	TryReadConstraintHead,
} from "./sql-constraints-fk.js"
import type {
	ConsumeStatementEnd,
	ReadFirstParenGroup,
	ReadOptionalIfNotExists,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { SkipStatement, SkippedStatement } from "./skip-statement.js"
import type { TokensList, EmptyTokenList, PeekToken, SqlParserError } from "./sql-tokens.js"

export type CreateTableStatement = {
	readonly kind: "create_table"
	readonly name: SqlQualifiedIdentifier | SqlParserError<string>
	readonly row: unknown
	readonly refs: ForeignRefMeta | undefined
	readonly intraTableConstraints: readonly IntraTableConstraintRef[]
}

/** `Tokens` must be the buffer immediately after the `table` token (caller routes with `PeekToken` then `SkipToken`). */
export type ParseCreateTable<Tokens extends TokensList> = FinalizeCreateTableTuple<
	ParseCreateTableTupleAfterTable<Tokens>
>

type FinalizeCreateTableTuple<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [infer StatementResult, infer StatementRest extends TokensList]
		? StatementResult extends {
					name: infer TabName extends SqlQualifiedIdentifier
					body: infer Body extends TokensList
			  }
			? SqlCreateTableParsedFromBody<Body> extends infer Parsed
				? SqlCreateTableParsedToType<Parsed> extends SqlParserError<infer E2>
					? [SqlParserError<E2>, StatementRest]
					: [
							{
								readonly kind: "create_table"
								readonly name: TabName
								// General rule: types are helpers and must not become a bottleneck.
								readonly row: SqlCreateTableParsedToType<Parsed> extends infer Row
									? { [K in keyof Row]: Row[K] }
									: never
								readonly refs: SqlCreateTableParsedRefs<Parsed>
								readonly intraTableConstraints: SqlCreateTableParsedIntra<Parsed>
							},
							StatementRest,
						]
				: [SqlParserError<"Internal SQL parser error">, StatementRest]
			: [SqlParserError<"Internal SQL parser error">, StatementRest]
		: [SqlParserError<"Internal SQL parser error">, EmptyTokenList]

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type AppendIntra<
	I extends readonly IntraTableConstraintRef[],
	X extends IntraTableConstraintRef,
> = readonly [...I, X]

type CreateBodyState<
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends readonly IntraTableConstraintRef[],
> = {
	row: Row
	names: Names
	error: Error
	refs: Refs
	intraTableConstraints: Intra
}

type ParseCreateBody<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
	Intra extends readonly IntraTableConstraintRef[] = readonly [],
> =
	PeekToken<Tokens> extends ""
		? [CreateBodyState<Row, Names, Error, Refs, Intra>, Tokens]
		: TryReadConstraintHead<Tokens> extends infer H
			? H extends readonly ["err", infer E extends SqlParserError<string>, infer ER extends TokensList]
				? [CreateBodyState<Row, Names, MergeError<Error, E>, Refs, Intra>, ER]
				: H extends readonly ["yes", infer P extends { kind: string; afterKw: TokensList }]
					? ParseCreateBodyConstraint<P["kind"], P["afterKw"], Row, Names, Error, Refs, Intra>
					: H extends readonly ["no", infer Rest extends TokensList]
						? ParseCreateBodyColumn<Rest, Row, Names, Error, Refs, Intra>
						: [
								CreateBodyState<
									Row,
									Names,
									MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
									Refs,
									Intra
								>,
								EmptyTokenList,
							]
			: [
					CreateBodyState<
						Row,
						Names,
						MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
						Refs,
						Intra
					>,
					EmptyTokenList,
				]

type ParseCreateBodyColumn<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends readonly IntraTableConstraintRef[],
> = AddColumn<Tokens, Row, Names> extends infer Added extends {
	row: unknown
	names: string
	error: unknown
	rest: TokensList
}
	? [Added["error"]] extends [never]
		? SkipStatement<Added["rest"], "," | ")" | ""> extends [SkippedStatement<infer EndTk>, infer NextTail extends TokensList]
			? EndTk extends ","
				? ParseCreateBody<NextTail, Added["row"], Added["names"], Error, Refs, Intra>
				: [CreateBodyState<Added["row"], Added["names"], Error, Refs, Intra>, NextTail]
			: [CreateBodyState<Added["row"], Added["names"], Error, Refs, Intra>, Added["rest"]]
		: [CreateBodyState<Row, Names, MergeError<Error, Added["error"]>, Refs, Intra>, Added["rest"]]
		: [
			CreateBodyState<
				Row,
				Names,
				MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
				Refs,
				Intra
			>,
			EmptyTokenList,
		]

type ParseCreateBodyConstraint<
	Kind extends string,
	AfterKw extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends readonly IntraTableConstraintRef[],
> = ParseConstraintBody<Kind, AfterKw> extends [infer EntryResult, infer BodyRest extends TokensList]
	? SkipStatement<BodyRest, "," | ")" | ""> extends [SkippedStatement<infer EndTk>, infer NextTail extends TokensList]
		? EntryResult extends SqlParserError<string>
			? EndTk extends ","
				? ParseCreateBody<NextTail, Row, Names, MergeError<Error, EntryResult>, Refs, Intra>
				: [CreateBodyState<Row, Names, MergeError<Error, EntryResult>, Refs, Intra>, NextTail]
			: EntryResult extends ForeignRefMeta
				? EndTk extends ","
					? ParseCreateBody<NextTail, Row, Names, Error, Refs | EntryResult, Intra>
					: [CreateBodyState<Row, Names, Error, Refs | EntryResult, Intra>, NextTail]
				: EntryResult extends {
							readonly kind: "primary_key"
							readonly columns: infer Cols extends readonly string[]
					  }
					? EndTk extends ","
						? ParseCreateBody<
								NextTail,
								Row,
								Names,
								Error,
								Refs,
								AppendIntra<Intra, { readonly kind: "primary_key"; readonly columns: Cols }>
							>
						: [
								CreateBodyState<
									Row,
									Names,
									Error,
									Refs,
									AppendIntra<Intra, { readonly kind: "primary_key"; readonly columns: Cols }>
								>,
								NextTail,
							]
					: EntryResult extends {
								readonly kind: "unique"
								readonly columns: infer Cols extends readonly string[]
						  }
						? EndTk extends ","
							? ParseCreateBody<
									NextTail,
									Row,
									Names,
									Error,
									Refs,
									AppendIntra<Intra, { readonly kind: "unique"; readonly columns: Cols }>
								>
							: [
									CreateBodyState<
										Row,
										Names,
										Error,
										Refs,
										AppendIntra<Intra, { readonly kind: "unique"; readonly columns: Cols }>
									>,
									NextTail,
								]
						: EndTk extends ","
							? ParseCreateBody<NextTail, Row, Names, Error, Refs, Intra>
							: [CreateBodyState<Row, Names, Error, Refs, Intra>, NextTail]
		: [
				CreateBodyState<
					Row,
					Names,
					MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
					Refs,
					Intra
				>,
				EmptyTokenList,
			]
	: [
			CreateBodyState<
				Row,
				Names,
				MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
				Refs,
				Intra
			>,
			EmptyTokenList,
		]

type ParseCreateTableTupleAfterTable<Tokens extends TokensList> = ParseCreateTableStatementBody<Tokens>

type ParseCreateTableStatementBody<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer FlagOrError extends boolean | SqlParserError<string>,
		infer RestAfterFlag extends TokensList,
	]
		? FlagOrError extends SqlParserError<string>
			? [FlagOrError, RestAfterFlag]
			: FlagOrError extends true
				? ParseCreateTableWithFlag<true, RestAfterFlag>
				: ParseCreateTableWithFlag<false, RestAfterFlag>
		: [SqlParserError<"Unable to parse CREATE TABLE statement">, EmptyTokenList]

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
				: [SqlParserError<"Expected CREATE TABLE body in parentheses">, EmptyTokenList]
			: [SqlParserError<"Expected CREATE TABLE body in parentheses">, EmptyTokenList]
		: [SqlParserError<"Expected a CREATE TABLE statement with a table name">, EmptyTokenList]

type SqlCreateTableParsedFromBody<Body extends TokensList> = ParseCreateBody<Body, {}, never> extends [
	infer Parsed extends {
		row: unknown
		error: unknown
		refs: unknown
		intraTableConstraints: readonly IntraTableConstraintRef[]
	},
	infer BodyRest extends TokensList,
]
	? [Parsed["error"]] extends [never]
		? PeekToken<BodyRest> extends "" | ";"
			? Parsed
			: SqlParserError<"Unexpected trailing input in CREATE TABLE body">
		: Parsed
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

type SqlCreateTableParsedIntra<Parsed> = Parsed extends {
	intraTableConstraints: infer I extends readonly IntraTableConstraintRef[]
}
	? I
	: readonly []
