import type { ReadExpectedToken, ReadQualifiedIdentifierFromBuffer, SqlQualifiedIdentifier } from "./sql-primitives.ts"
import type {
	TokensList,
	PeekToken,
	SkipToken,
	SqlParserError,
	ReadToken,
	TokenIdent,
	TokenKey,
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
	PeekToken<Tokens> extends TokenKey<"constraint">
		? TryReadConstraintHeadAfterConstraintKeyword<SkipToken<Tokens>>
		: TryReadConstraintHeadUnprefixed<Tokens>

export type ParseConstraintBody<Tokens extends TokensList, Kind extends string> = Kind extends "primary_key"
	? ParseColumnList<Tokens> extends [infer AfterClose extends TokensList, infer Cols]
		? Cols extends string[]
			? [AfterClose, { kind: "primary_key"; columns: Cols }]
			: [AfterClose, SqlParserError<"Unable to parse PRIMARY KEY column list">]
		: never
	: Kind extends "unique"
		? ParseColumnList<Tokens> extends [infer AfterClose extends TokensList, infer Cols]
			? Cols extends string[]
				? [AfterClose, { kind: "unique"; columns: Cols }]
				: [AfterClose, SqlParserError<"Unable to parse UNIQUE column list">]
			: never
		: Kind extends "foreign_key"
			? ParseForeignKeyMetaAndRest<Tokens>
			: [Tokens, { kind: "other" }]

export type ParseColumnList<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "(", "Expected ( before column list"> extends [
		infer Rest extends TokensList,
		infer OpenOk,
	]
		? OpenOk extends true
			? ParseColumnListTail<Rest>
			: [Rest, Extract<OpenOk, SqlParserError<string>>]
		: never

type ParseColumnListTail<Tokens extends TokensList, Acc extends string[] = []> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc]
		: PeekToken<Tokens> extends TokenIdent<infer Col extends string>
			? ParseColumnListTailAfterColumn<SkipToken<Tokens>, [...Acc, Col]>
			: [Tokens, SqlParserError<"Expected column name in column list">]

type ParseColumnListTailAfterColumn<Tokens extends TokensList, Acc extends string[]> =
	PeekToken<Tokens> extends TokenKey<",">
		? ParseColumnListTail<SkipToken<Tokens>, Acc>
		: PeekToken<Tokens> extends TokenKey<")">
			? [SkipToken<Tokens>, Acc]
			: [Tokens, SqlParserError<"Expected ) after column list">]

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
	ParseColumnList<Tokens> extends [infer AfterLocalCols extends TokensList, infer LocalCols]
		? LocalCols extends string[]
			? ReadExpectedToken<AfterLocalCols, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
					infer URef extends TokensList,
					infer OkRef,
				]
				? OkRef extends true
					? ReadQualifiedIdentifierFromBuffer<URef> extends [
							infer AfterTarget extends TokensList,
							infer Target extends SqlQualifiedIdentifier,
						]
						? ParseForeignKeyMetaWithLocalCols<AfterTarget, Target, LocalCols>
						: never
					: [URef, Extract<OkRef, SqlParserError<string>>]
				: never
			: [AfterLocalCols, SqlParserError<"Unable to parse local column list in foreign key">]
		: never

type ParseForeignKeyMetaWithLocalCols<
	Tokens extends TokensList,
	Target extends SqlQualifiedIdentifier,
	FC extends string[],
> =
	ParseColumnList<Tokens> extends [infer AfterTargetCols extends TokensList, infer TargetCols]
		? TargetCols extends string[]
			? ZipColumnListsToPairs<FC, TargetCols> extends infer Pairs
				? Pairs extends SqlParserError<string>
					? [AfterTargetCols, Pairs]
					: Pairs extends FkColumnPair[]
						? Target extends [infer Table extends string]
							? [
									AfterTargetCols,
									{
										from: ""
										columnPairs: Pairs
										toSchema: undefined
										toTable: Table
									},
								]
							: Target extends [infer Table extends string, infer Schema extends string]
								? [
										AfterTargetCols,
										{
											from: ""
											columnPairs: Pairs
											toSchema: Schema
											toTable: Table
										},
									]
								: [AfterTargetCols, SqlParserError<"Unable to build foreign key column pairs">]
						: [AfterTargetCols, SqlParserError<"Unable to build foreign key column pairs">]
				: [AfterTargetCols, SqlParserError<"Unable to build foreign key column pairs">]
			: [AfterTargetCols, SqlParserError<"Unable to parse referenced column list in foreign key">]
		: never

type TryReadConstraintHeadUnprefixed<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"primary">
		? ReadToken<Tokens> extends [infer AfterPrimary extends TokensList, infer _X]
			? PeekToken<AfterPrimary> extends TokenKey<"key">
				? [SkipToken<AfterPrimary>, { kind: "yes"; constraintKind: "primary_key" }]
				: [AfterPrimary, { kind: "no" }]
			: never
		: PeekToken<Tokens> extends TokenKey<"unique">
			? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "unique" }]
			: PeekToken<Tokens> extends TokenKey<"foreign">
				? ReadToken<Tokens> extends [infer AfterForeign extends TokensList, infer _X]
					? PeekToken<AfterForeign> extends TokenKey<"key">
						? [SkipToken<AfterForeign>, { kind: "yes"; constraintKind: "foreign_key" }]
						: [AfterForeign, { kind: "no" }]
					: never
				: PeekToken<Tokens> extends TokenKey<"check" | "exclude">
					? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "other" }]
					: [Tokens, { kind: "no" }]

type TryReadConstraintHeadAfterConstraintKeyword<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenIdent<infer NameResult extends string>
		? ReadConstraintKeywordOnStripped<SkipToken<Tokens>, NameResult>
		: [Tokens, SqlParserError<"Expected constraint name after CONSTRAINT">]

type ReadConstraintKeywordOnStripped<Tokens extends TokensList, Name extends string | SqlParserError<string> = never> =
	PeekToken<Tokens> extends TokenKey<"primary">
		? ReadExpectedToken<SkipToken<Tokens>, "key", "Expected KEY after PRIMARY"> extends [
				infer AfterKey extends TokensList,
				infer KeyOk,
			]
			? KeyOk extends true
				? [
						AfterKey,
						Name extends string
							? { kind: "yes"; constraintKind: "primary_key"; name: Name }
							: { kind: "yes"; constraintKind: "primary_key" },
					]
				: [AfterKey, { kind: "no" }]
			: never
		: PeekToken<Tokens> extends TokenKey<"unique">
			? [
					SkipToken<Tokens>,
					Name extends string
						? { kind: "yes"; constraintKind: "unique"; name: Name }
						: { kind: "yes"; constraintKind: "unique" },
				]
			: PeekToken<Tokens> extends TokenKey<"foreign">
				? ReadExpectedToken<SkipToken<Tokens>, "key", "Expected KEY after FOREIGN"> extends [
						infer AfterKey extends TokensList,
						infer KeyOk,
					]
					? KeyOk extends true
						? [
								AfterKey,
								Name extends string
									? { kind: "yes"; constraintKind: "foreign_key"; name: Name }
									: { kind: "yes"; constraintKind: "foreign_key" },
							]
						: [AfterKey, { kind: "no" }]
					: never
				: PeekToken<Tokens> extends TokenKey<"check" | "exclude" | "constraint">
					? [SkipToken<Tokens>, { kind: "yes"; constraintKind: "other" }]
					: [
							Tokens,
							SqlParserError<"Expected PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, or EXCLUDE after constraint name">,
						]
