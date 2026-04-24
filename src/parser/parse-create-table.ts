import type { AddColumn } from "./sql-column.ts"
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
type ConstraintHeadToken = "constraint" | "primary" | "unique" | "foreign" | "check" | "exclude"

type CreateBodyState<
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
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
	Intra extends IntraTableConstraintRef[] = [],
> =
	PeekToken<Tokens> extends TokenType<"">
		? [Tokens, CreateBodyState<Row, Names, Error, Refs, Intra>]
		: PeekToken<Tokens> extends TokenType<")">
			? [Tokens, CreateBodyState<Row, Names, Error, Refs, Intra>]
			: PeekToken<Tokens> extends TokenType<ConstraintHeadToken>
				? ParseCreateBodyConstraintOrError<Tokens, Row, Names, Error, Refs, Intra>
				: ParseCreateBodyColumn<Tokens, Row, Names, Error, Refs, Intra>

type ParseCreateBodyConstraintOrError<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
> =
	TryReadConstraintHead<Tokens> extends [infer HeadRest extends TokensList, infer Head]
		? Head extends SqlParserError<string>
			? [HeadRest, CreateBodyState<Row, Names, MergeError<Error, Head>, Refs, Intra>]
			: Head extends { kind: "yes"; constraintKind: infer K extends string }
				? ParseCreateBodyConstraint<HeadRest, K, Row, Names, Error, Refs, Intra>
				: ParseCreateBodyColumn<HeadRest, Row, Names, Error, Refs, Intra>
		: never

type ParseCreateBodyColumn<
	Tokens extends TokensList,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
> =
	AddColumn<Tokens, Row, Names> extends [
		infer RestAfterCol extends TokensList,
		infer Added extends { row: unknown; names: string; error: unknown },
	]
		? [Added["error"]] extends [never]
			? SkipStatement<RestAfterCol, "," | ")" | ""> extends [infer NextTail extends TokensList, infer SkipResult]
				? SkipResult extends SkippedStatement<infer EndTk>
					? EndTk extends TokenType<",">
						? ParseCreateBody<NextTail, Added["row"], Added["names"], Error, Refs, Intra>
						: [NextTail, CreateBodyState<Added["row"], Added["names"], Error, Refs, Intra>]
					: [NextTail, CreateBodyState<Added["row"], Added["names"], Error, Refs, Intra>]
				: never
			: [RestAfterCol, CreateBodyState<Row, Names, MergeError<Error, Added["error"]>, Refs, Intra>]
		: never

type ParseCreateBodyConstraint<
	Tokens extends TokensList,
	Kind extends string,
	Row,
	Names extends string,
	Error,
	Refs extends ForeignRefMeta,
	Intra extends IntraTableConstraintRef[],
> =
	ParseConstraintBody<Tokens, Kind> extends [infer BodyRest extends TokensList, infer EntryResult]
			? SkipStatement<BodyRest, "," | ")" | ""> extends [infer NextTail extends TokensList, infer SkipResult]
				? SkipResult extends SkippedStatement<infer EndTk>
					? EntryResult extends SqlParserError<string>
					? EndTk extends TokenType<",">
						? ParseCreateBody<NextTail, Row, Names, MergeError<Error, EntryResult>, Refs, Intra>
						: [NextTail, CreateBodyState<Row, Names, MergeError<Error, EntryResult>, Refs, Intra>]
					: EntryResult extends ForeignRefMeta
						? EndTk extends TokenType<",">
							? ParseCreateBody<NextTail, Row, Names, Error, Refs | EntryResult, Intra>
							: [NextTail, CreateBodyState<Row, Names, Error, Refs | EntryResult, Intra>]
						: EntryResult extends {
									kind: "primary_key"
									columns: infer Cols extends string[]
							  }
							? EndTk extends TokenType<",">
								? ParseCreateBody<
										NextTail,
										Row,
										Names,
										Error,
										Refs,
										AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>
									>
								: [
										NextTail,
										CreateBodyState<
											Row,
											Names,
											Error,
											Refs,
											AppendIntra<Intra, { kind: "primary_key"; columns: Cols }>
										>,
									]
								: EntryResult extends {
											kind: "unique"
											columns: infer Cols extends string[]
									  }
									? EndTk extends TokenType<",">
										? ParseCreateBody<
												NextTail,
												Row,
											Names,
											Error,
											Refs,
											AppendIntra<Intra, { kind: "unique"; columns: Cols }>
										>
									: [
											NextTail,
											CreateBodyState<
												Row,
												Names,
												Error,
												Refs,
												AppendIntra<Intra, { kind: "unique"; columns: Cols }>
											>,
										]
								: EndTk extends TokenType<",">
									? ParseCreateBody<NextTail, Row, Names, Error, Refs, Intra>
									: [NextTail, CreateBodyState<Row, Names, Error, Refs, Intra>]
				: [
						NextTail,
						CreateBodyState<
							Row,
							Names,
							MergeError<Error, SqlParserError<"Unable to parse CREATE TABLE body">>,
							Refs,
							Intra
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
											},
										]
									: [RestTail, SqlParserError<"Expected CREATE TABLE body in parentheses">]
								: never
							: [BodyRest, Parsed["error"]]
						: never
					: [AfterOpen, Extract<OpenOk, SqlParserError<string>>]
				: never
		: never
