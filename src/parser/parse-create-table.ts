import type { AddColumn, ColumnFactsEntry } from "./sql-column.ts"
import type {
	ForeignRefMeta,
	IntraTableConstraintRef,
	ParseConstraintBody,
	TryReadConstraintHead,
} from "./sql-constraints-fk.ts"
import type {
	ConsumeStatementEnd,
	ReadOptionalIfNotExists,
	ReadExpectedToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { SkipStatement, SkippedStatement } from "./skip-statement.ts"
import type { TokensList, PeekToken, SqlParserError, TokenType } from "../../core/sql-tokens.ts"

export type CreateTableStatement = {
	kind: "create_table"
	name: SqlQualifiedIdentifier | SqlParserError<string>
	row: unknown
	refs: ForeignRefMeta | undefined
	intraTableConstraints: IntraTableConstraintRef[]
	namedIntraTableConstraints?: NamedIntraTableConstraint[]
	columnFacts?: Record<string, ColumnFactsEntry>
}

type NamedIntraTableConstraint = {
	name: string
	kind: "primary_key" | "unique"
	columns: string[]
}

export type ParseCreateTable<Tokens extends TokensList> =
	ReadOptionalIfNotExists<Tokens> extends [
		infer RestAfterFlag extends TokensList,
		infer FlagOrError extends boolean | SqlParserError<string>,
	]
		? FlagOrError extends SqlParserError<string>
			? [RestAfterFlag, FlagOrError]
			: FlagOrError extends true
				? ParseCreateTableWithFlag<RestAfterFlag, true>
				: ParseCreateTableWithFlag<RestAfterFlag, false>
		: never

type MergeError<Current, Next> = Next extends true ? Current : Current | Next

type AppendIntra<I extends IntraTableConstraintRef[], X extends IntraTableConstraintRef> = [...I, X]
type AppendNamed<I extends NamedIntraTableConstraint[], X extends NamedIntraTableConstraint> = [...I, X]
type MergeColumnFacts<Current, Next> = [Next] extends [never] ? Current : [Current] extends [never] ? Next : Current & Next
type ConstraintHeadToken = "constraint" | "primary" | "unique" | "foreign" | "check" | "exclude"

type CreateBodyState<
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
	Named extends NamedIntraTableConstraint[],
	ColumnFacts,
> = {
	row: Row
	names: Names
	error: Error
	refs: Refs
	intraTableConstraints: Intra
	namedIntraTableConstraints: Named
	columnFacts: ColumnFacts
}

type ParseCreateBody<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error = never,
	Refs extends ForeignRefMeta = never,
	Intra extends IntraTableConstraintRef[] = [],
	Named extends NamedIntraTableConstraint[] = [],
	ColumnFacts = never,
> =
	PeekToken<Tokens> extends TokenType<"">
		? [Tokens, CreateBodyState<Row, Names, Error, Refs, Intra, Named, ColumnFacts>]
		: PeekToken<Tokens> extends TokenType<")">
			? [Tokens, CreateBodyState<Row, Names, Error, Refs, Intra, Named, ColumnFacts>]
			: PeekToken<Tokens> extends TokenType<ConstraintHeadToken>
				? ParseCreateBodyConstraintOrError<Tokens, Row, Names, Error, Refs, Intra, Named, ColumnFacts>
				: ParseCreateBodyColumn<Tokens, Row, Names, Error, Refs, Intra, Named, ColumnFacts>

type ParseCreateBodyConstraintOrError<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
	Named extends NamedIntraTableConstraint[],
	ColumnFacts,
> =
	TryReadConstraintHead<Tokens> extends [infer HeadRest extends TokensList, infer Head]
		? Head extends SqlParserError<string>
			? [HeadRest, CreateBodyState<Row, Names, MergeError<Error, Head>, Refs, Intra, Named, ColumnFacts>]
		: Head extends { kind: "yes"; constraintKind: infer K extends string }
			? ParseCreateBodyConstraint<HeadRest, K, Row, Names, Error, Refs, Intra, Named, ColumnFacts, Head>
			: ParseCreateBodyColumn<HeadRest, Row, Names, Error, Refs, Intra, Named, ColumnFacts>
		: never

type ParseCreateBodyColumn<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
	Named extends NamedIntraTableConstraint[],
	ColumnFacts,
> =
	AddColumn<Tokens, Row, Names> extends [
		infer RestAfterCol extends TokensList,
		infer Added extends { row: unknown; names: string; error: unknown; facts: unknown },
	]
		? [Added["error"]] extends [never]
			? SkipStatement<RestAfterCol, "," | ")" | ""> extends [infer NextTail extends TokensList, infer SkipResult]
				? SkipResult extends SkippedStatement<infer EndTk>
					? EndTk extends TokenType<",">
						? ParseCreateBody<
								NextTail,
								Added["row"],
								Added["names"],
								Error,
								Refs,
								Intra,
								Named,
								MergeColumnFacts<ColumnFacts, Added["facts"]>
							>
						: [
								NextTail,
								CreateBodyState<
									Added["row"],
									Added["names"],
									Error,
									Refs,
									Intra,
									Named,
									MergeColumnFacts<ColumnFacts, Added["facts"]>
								>,
							]
					: [
							NextTail,
							CreateBodyState<
								Added["row"],
								Added["names"],
								Error,
								Refs,
								Intra,
								Named,
								MergeColumnFacts<ColumnFacts, Added["facts"]>
							>,
						]
				: never
				: [RestAfterCol, CreateBodyState<Row, Names, MergeError<Error, Added["error"]>, Refs, Intra, Named, ColumnFacts>]
			: never

type ParseCreateBodyConstraint<
	Tokens extends TokensList,
	Kind extends string,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
	Named extends NamedIntraTableConstraint[],
	ColumnFacts,
	Head,
> =
	ParseConstraintBody<Tokens, Kind> extends [infer BodyRest extends TokensList, infer EntryResult]
			? SkipStatement<BodyRest, "," | ")" | ""> extends [infer NextTail extends TokensList, infer SkipResult]
				? SkipResult extends SkippedStatement<infer EndTk>
					? EntryResult extends SqlParserError<string>
					? EndTk extends TokenType<",">
						? ParseCreateBody<NextTail, Row, Names, MergeError<Error, EntryResult>, Refs, Intra, Named, ColumnFacts>
						: [NextTail, CreateBodyState<Row, Names, MergeError<Error, EntryResult>, Refs, Intra, Named, ColumnFacts>]
					: EntryResult extends ForeignRefMeta
						? EndTk extends TokenType<",">
							? ParseCreateBody<NextTail, Row, Names, Error, Refs | EntryResult, Intra, Named, ColumnFacts>
							: [NextTail, CreateBodyState<Row, Names, Error, Refs | EntryResult, Intra, Named, ColumnFacts>]
						: EntryResult extends {
									kind: "primary_key"
									columns: infer Cols extends string[]
							  }
							? Head extends { name: infer CName extends string }
								? EndTk extends TokenType<",">
									? ParseCreateBody<
											NextTail,
											Row,
											Names,
											Error,
											Refs,
											AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>,
											AppendNamed<Named, { name: CName; kind: "primary_key"; columns: Cols }>,
											ColumnFacts
										>
									: [
											NextTail,
											CreateBodyState<
												Row,
												Names,
												Error,
												Refs,
												AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>,
												AppendNamed<Named, { name: CName; kind: "primary_key"; columns: Cols }>,
												ColumnFacts
											>,
										]
								: EndTk extends TokenType<",">
									? ParseCreateBody<
											NextTail,
											Row,
											Names,
											Error,
											Refs,
											AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>,
											Named,
											ColumnFacts
										>
									: [
											NextTail,
											CreateBodyState<
												Row,
												Names,
												Error,
												Refs,
												AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>,
												Named,
												ColumnFacts
											>,
										]
									: EntryResult extends {
												kind: "unique"
												columns: infer Cols extends string[]
										  }
										? Head extends { name: infer CName extends string }
											? EndTk extends TokenType<",">
												? ParseCreateBody<
														NextTail,
														Row,
													Names,
													Error,
													Refs,
													AppendIntra<Intra, { kind: "unique"; columns: Cols }>,
													AppendNamed<Named, { name: CName; kind: "unique"; columns: Cols }>,
													ColumnFacts
												>
											: [
													NextTail,
													CreateBodyState<
														Row,
														Names,
														Error,
														Refs,
														AppendIntra<Intra, { kind: "unique"; columns: Cols }>,
														AppendNamed<Named, { name: CName; kind: "unique"; columns: Cols }>,
														ColumnFacts
													>,
												]
										: EndTk extends TokenType<",">
											? ParseCreateBody<
													NextTail,
													Row,
												Names,
												Error,
												Refs,
												AppendIntra<Intra, { kind: "unique"; columns: Cols }>,
												Named,
												ColumnFacts
											>
										: [
												NextTail,
												CreateBodyState<
													Row,
													Names,
													Error,
													Refs,
													AppendIntra<Intra, { kind: "unique"; columns: Cols }>,
													Named,
													ColumnFacts
												>,
											]
									: EndTk extends TokenType<",">
										? ParseCreateBody<NextTail, Row, Names, Error, Refs, Intra, Named, ColumnFacts>
										: [NextTail, CreateBodyState<Row, Names, Error, Refs, Intra, Named, ColumnFacts>]
					: [
							NextTail,
							CreateBodyState<
								Row,
								Names,
								MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
								Refs,
								Intra,
								Named,
								ColumnFacts
							>,
						]
				: never
			: never

type ParseCreateTableWithFlag<Tokens extends TokensList, IfNotExists extends boolean> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [
		infer RestAfterName extends TokensList,
		infer NameResult extends SqlQualifiedIdentifier | SqlParserError<string>,
	]
		? NameResult extends SqlParserError<string>
			? [RestAfterName, NameResult]
			: ReadExpectedToken<RestAfterName, "(", "Expected CREATE TABLE body in parentheses"> extends [
						infer AfterOpen extends TokensList,
						infer OpenOk,
				  ]
				? OpenOk extends true
					? ParseCreateBody<AfterOpen, {}, never> extends [
							infer BodyRest extends TokensList,
							infer Parsed extends {
								row: unknown
								error: unknown
								refs: unknown
								intraTableConstraints: IntraTableConstraintRef[]
								namedIntraTableConstraints: NamedIntraTableConstraint[]
								columnFacts: unknown
							},
						]
						? [Parsed["error"]] extends [never]
							? ConsumeStatementEnd<BodyRest> extends [
									infer RestTail extends TokensList,
									infer EndOk extends boolean,
								]
								? EndOk extends true
											? [
													RestTail,
													{
														kind: "create_table"
														name: NameResult
														row: Parsed["row"] extends infer Row
															? { [K in keyof Row]: Row[K] }
															: never
														refs: [Parsed["refs"]] extends [never]
															? undefined
															: Extract<Parsed["refs"], ForeignRefMeta>
														intraTableConstraints: Parsed["intraTableConstraints"]
													}
														& ([Parsed["namedIntraTableConstraints"]] extends [never]
															? {}
															: Parsed["namedIntraTableConstraints"] extends []
																? {}
																: { namedIntraTableConstraints: Parsed["namedIntraTableConstraints"] })
														& ([Parsed["columnFacts"]] extends [never]
															? {}
															: keyof Extract<Parsed["columnFacts"], Record<string, ColumnFactsEntry>> extends never
																? {}
																: { columnFacts: Extract<Parsed["columnFacts"], Record<string, ColumnFactsEntry>> }),
												]
										: [RestTail, SqlParserError<"Expected CREATE TABLE body in parentheses">]
									: never
							: [BodyRest, Parsed["error"]]
						: never
					: [AfterOpen, Extract<OpenOk, SqlParserError<string>>]
				: never
		: never
