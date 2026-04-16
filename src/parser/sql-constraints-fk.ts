import type {
	IsBufferEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type {
	TokensList,
	PeekToken,
	SkipToken,
	SqlParserError,
	ParseSqlTokens,
	ReadToken,
} from "../../core/sql-tokens.ts"

export type ForeignRefMeta = {
	from: string
	columnPairs: FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = [local: string, referenced: string]

export type IntraTableConstraintRef = { kind: "primary_key"; columns: string[] } | { kind: "unique"; columns: string[] }

export type TryReadConstraintHead<Tokens extends TokensList> =
	PeekToken<Tokens> extends "constraint"
		? TryReadConstraintHeadAfterConstraintKeyword<SkipToken<Tokens>>
		: TryReadConstraintHeadUnprefixed<Tokens>

export type ParseConstraintBody<Tokens extends TokensList, Kind extends string> = Kind extends "primary_key"
	? ReadFirstParenGroup<Tokens> extends [infer AfterClose extends TokensList, infer Inner extends string]
		? ParseColumnListToTuple<ParseSqlTokens<Inner>> extends [infer _RestCols extends TokensList, infer Cols]
			? Cols extends string[]
				? [AfterClose, { kind: "primary_key"; columns: Cols }]
				: [AfterClose, SqlParserError<"Unable to parse PRIMARY KEY column list">]
			: never
		: never
	: Kind extends "unique"
		? ReadFirstParenGroup<Tokens> extends [infer AfterClose extends TokensList, infer Inner extends string]
			? ParseColumnListToTuple<ParseSqlTokens<Inner>> extends [infer _RestCols extends TokensList, infer Cols]
				? Cols extends string[]
					? [AfterClose, { kind: "unique"; columns: Cols }]
					: [AfterClose, SqlParserError<"Unable to parse UNIQUE column list">]
				: never
			: never
		: Kind extends "foreign_key"
			? ParseForeignKeyMetaAndRest<Tokens>
			: [Tokens, { kind: "other" }]

export type ParseColumnListToTuple<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [Tokens, []]
		: ReadExpectedIdentifier<Tokens, "Expected column name in column list"> extends [
					infer AfterId extends TokensList,
					infer Col,
			  ]
			? Col extends string
				? PeekToken<AfterId> extends ","
					? ParseColumnListToTuple<SkipToken<AfterId>> extends [infer Tail extends TokensList, infer Rest]
						? Rest extends string[]
							? [Tail, [Col, ...Rest]]
							: [Tail, SqlParserError<"Expected column name in column list">]
						: never
					: PeekToken<AfterId> extends "" | ")"
						? [AfterId, [Col]]
						: IsBufferEnd<AfterId> extends [infer RestEnd extends TokensList, infer Ended extends boolean]
							? Ended extends true
								? [RestEnd, [Col]]
								: [RestEnd, SqlParserError<"Expected column name in column list">]
							: never
				: [AfterId, Extract<Col, SqlParserError<string>>]
			: never

export type ValidateColumnTupleRefs<Cols extends string[], Names extends string> = Cols extends [
	infer H extends string,
	...infer R extends string[],
]
	? H extends Names
		? ValidateColumnTupleRefs<R, Names>
		: SqlParserError<`Unknown column "${H}" referenced in table constraint`>
	: Cols extends []
		? true
		: SqlParserError<"Unable to parse column reference list in table constraint">

export type ZipColumnListsToPairs<
	From extends string[],
	To extends string[],
	Acc extends FkColumnPair[] = [],
> = From extends []
	? To extends []
		? Acc
		: SqlParserError<"Foreign key referenced column list has more entries than the local column list">
	: To extends []
		? SqlParserError<"Foreign key local column list has more entries than the referenced column list">
		: From extends [infer FH extends string, ...infer FT extends string[]]
			? To extends [infer TH extends string, ...infer TT extends string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, [FH, TH]]>
				: SqlParserError<"Foreign key referenced column list has more entries than the local column list">
			: SqlParserError<"Foreign key referenced column list has more entries than the local column list">

export type ValidateFkLocalColumnPairs<Pairs extends FkColumnPair[], Names extends string> = Pairs extends [
	[infer L extends string, string],
	...infer Rest extends FkColumnPair[],
]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names>
		: SqlParserError<`Unknown column "${L}" referenced in table constraint`>
	: Pairs extends []
		? true
		: SqlParserError<"Unable to validate foreign key local columns">

export type ValidateFkReferencedColumnPairs<Pairs extends FkColumnPair[], TargetNames extends string> = Pairs extends [
	[string, infer R extends string],
	...infer Rest extends FkColumnPair[],
]
	? R extends TargetNames
		? ValidateFkReferencedColumnPairs<Rest, TargetNames>
		: SqlParserError<`Unknown column "${R}" referenced in table constraint`>
	: Pairs extends []
		? true
		: SqlParserError<"Unable to validate foreign key referenced columns">

export type ParseForeignKeyMetaAndRest<Tokens extends TokensList> =
	ReadFirstParenGroup<Tokens> extends [infer R1 extends TokensList, infer LocalBuf extends string]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
				infer URef extends TokensList,
				infer OkRef,
			]
			? OkRef extends true
				? ReadQualifiedIdentifierFromBuffer<URef> extends [
						infer R2 extends TokensList,
						infer Target extends SqlQualifiedIdentifier,
					]
					? ReadFirstParenGroup<R2> extends [infer R3 extends TokensList, infer TargetColsBuf extends string]
						? ParseColumnListToTuple<ParseSqlTokens<LocalBuf>> extends [
								infer _RestLocal extends TokensList,
								infer FC,
							]
							? ParseForeignKeyMetaWithLocalCols<R3, Target, FC, TargetColsBuf>
							: never
						: never
					: never
				: [URef, Extract<OkRef, SqlParserError<string>>]
			: never
		: never

type ParseForeignKeyMetaWithLocalCols<
	Tokens extends TokensList,
	Target extends SqlQualifiedIdentifier,
	FC,
	TargetColsBuf extends string,
> = FC extends string[]
	? ParseColumnListToTuple<ParseSqlTokens<TargetColsBuf>> extends [infer _RestTarget extends TokensList, infer TC]
		? TC extends string[]
			? ZipColumnListsToPairs<FC, TC> extends infer Pairs
				? Pairs extends SqlParserError<string>
					? [Tokens, Pairs]
					: Pairs extends FkColumnPair[]
						? Target extends [infer Table extends string]
							? [
									Tokens,
									{
										from: ""
										columnPairs: Pairs
										toSchema: undefined
										toTable: Table
									},
								]
							: Target extends [infer Table extends string, infer Schema extends string]
								? [
										Tokens,
										{
											from: ""
											columnPairs: Pairs
											toSchema: Schema
											toTable: Table
										},
									]
								: [Tokens, SqlParserError<"Unable to build foreign key column pairs">]
						: [Tokens, SqlParserError<"Unable to build foreign key column pairs">]
				: [Tokens, SqlParserError<"Unable to build foreign key column pairs">]
			: [Tokens, SqlParserError<"Unable to parse referenced column list in foreign key">]
		: never
	: [Tokens, SqlParserError<"Unable to parse local column list in foreign key">]

type TryReadConstraintHeadUnprefixed<Tokens extends TokensList> =
	PeekToken<Tokens> extends "primary"
		? ReadToken<Tokens> extends [infer AfterPrimary extends TokensList, infer _X]
			? PeekToken<AfterPrimary> extends "key"
				? [SkipToken<AfterPrimary>, { kind: "yes"; constraintKind: "primary_key" }]
				: [AfterPrimary, { kind: "no" }]
			: never
		: PeekToken<Tokens> extends "unique"
			? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "unique" }]
			: PeekToken<Tokens> extends "foreign"
				? ReadToken<Tokens> extends [infer AfterForeign extends TokensList, infer _X]
					? PeekToken<AfterForeign> extends "key"
						? [SkipToken<AfterForeign>, { kind: "yes"; constraintKind: "foreign_key" }]
						: [AfterForeign, { kind: "no" }]
					: never
				: PeekToken<Tokens> extends "check" | "exclude"
					? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "other" }]
					: [Tokens, { kind: "no" }]

type TryReadConstraintHeadAfterConstraintKeyword<Tokens extends TokensList> =
	ReadExpectedIdentifier<Tokens, "Expected constraint name after CONSTRAINT"> extends [
		infer RestName extends TokensList,
		infer NameResult,
	]
		? NameResult extends SqlParserError<string>
			? [RestName, NameResult]
			: ReadConstraintKeywordOnStripped<RestName>
		: never

type ReadConstraintKeywordOnStripped<Tokens extends TokensList> =
	PeekToken<Tokens> extends "primary"
		? ReadExpectedToken<SkipToken<Tokens>, "key", "Expected KEY after PRIMARY"> extends [
				infer AfterKey extends TokensList,
				infer KeyOk,
			]
			? KeyOk extends true
				? [AfterKey, { kind: "yes"; constraintKind: "primary_key" }]
				: [AfterKey, { kind: "no" }]
			: never
		: PeekToken<Tokens> extends "unique"
			? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "unique" }]
			: PeekToken<Tokens> extends "foreign"
				? ReadExpectedToken<SkipToken<Tokens>, "key", "Expected KEY after FOREIGN"> extends [
						infer AfterKey extends TokensList,
						infer KeyOk,
					]
					? KeyOk extends true
						? [AfterKey, { kind: "yes"; constraintKind: "foreign_key" }]
						: [AfterKey, { kind: "no" }]
					: never
				: PeekToken<Tokens> extends "check" | "exclude" | "constraint"
					? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "other" }]
					: [
							Tokens,
							SqlParserError<"Expected PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, or EXCLUDE after constraint name">,
						]
