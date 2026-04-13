import type {
	IsBufferEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { TokensList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type ForeignRefMeta = {
	from: string
	columnPairs: readonly FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = readonly [local: string, referenced: string]

/** PRIMARY KEY / UNIQUE column lists parsed from CREATE TABLE; validated at apply time against the row shape. */
export type IntraTableConstraintRef =
	| { readonly kind: "primary_key"; readonly columns: readonly string[] }
	| { readonly kind: "unique"; readonly columns: readonly string[] }

/**
 * Discriminated constraint-head probe with correct cursor threading.
 * - `readonly ["no", Tokens]` — not a table constraint head; second slot is the same buffer as input (nothing consumed).
 * - `readonly ["yes", payload]` — constraint type keywords consumed; continue from `payload.afterKw`.
 * - `readonly ["err", error, rest]` — committed constraint prefix was invalid; continue from `rest`.
 */
export type TryReadConstraintHead<Tokens extends TokensList> = PeekToken<Tokens> extends "constraint"
	? TryReadConstraintHeadAfterConstraintKeyword<SkipToken<Tokens>>
	: TryReadConstraintHeadUnprefixed<Tokens>

/**
 * Parses a table constraint body (no column-existence checks; those run in apply types).
 * Returns `[clause | SqlParserError, restAfterBodyClose]`.
 */
export type ParseConstraintBody<Kind extends string, AfterKw extends TokensList> = Kind extends "primary_key"
	? ReadFirstParenGroup<AfterKw> extends [infer Inner extends TokensList, infer AfterClose extends TokensList]
		? ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
			? [{ readonly kind: "primary_key"; readonly columns: Cols }, AfterClose]
			: [SqlParserError<"Unable to parse PRIMARY KEY column list">, AfterClose]
		: [SqlParserError<"PRIMARY KEY must include a column list">, AfterKw]
	: Kind extends "unique"
		? ReadFirstParenGroup<AfterKw> extends [infer Inner2 extends TokensList, infer AfterClose2 extends TokensList]
			? ParseColumnListToTuple<Inner2> extends [infer Cols2 extends readonly string[], infer __]
				? [{ readonly kind: "unique"; readonly columns: Cols2 }, AfterClose2]
				: [SqlParserError<"Unable to parse UNIQUE column list">, AfterClose2]
			: [SqlParserError<"UNIQUE must include a column list">, AfterKw]
		: Kind extends "foreign_key"
			? ParseFkConstraintEntrySyntaxOnly<AfterKw>
			: [{ readonly kind: "other" }, AfterKw]

export type ParseColumnListToTuple<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [readonly [], Tokens]
		: ReadExpectedIdentifier<Tokens, "Expected column name in column list"> extends [
					infer Col extends string,
					infer AfterId extends TokensList,
			  ]
			? PeekToken<AfterId> extends ","
				? ParseColumnListToTuple<SkipToken<AfterId>> extends [
						infer Rest extends readonly string[],
						infer Tail extends TokensList,
					]
					? [readonly [Col, ...Rest], Tail]
					: never
				: PeekToken<AfterId> extends "" | ")"
					? [readonly [Col], AfterId]
					: IsBufferEnd<AfterId> extends true
						? [readonly [Col], AfterId]
						: never
			: never

export type ValidateColumnTupleRefs<Cols extends readonly string[], Names extends string> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Names
		? ValidateColumnTupleRefs<R, Names>
		: SqlParserError<`Unknown column "${H}" referenced in table constraint`>
	: Cols extends readonly []
		? true
		: SqlParserError<"Unable to parse column reference list in table constraint">

export type ZipColumnListsToPairs<
	From extends readonly string[],
	To extends readonly string[],
	Acc extends readonly FkColumnPair[] = readonly [],
> = From extends readonly []
	? To extends readonly []
		? Acc
		: SqlParserError<"Foreign key referenced column list has more entries than the local column list">
	: To extends readonly []
		? SqlParserError<"Foreign key local column list has more entries than the referenced column list">
		: From extends readonly [infer FH extends string, ...infer FT extends readonly string[]]
			? To extends readonly [infer TH extends string, ...infer TT extends readonly string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, readonly [FH, TH]]>
				: SqlParserError<"Foreign key referenced column list has more entries than the local column list">
			: SqlParserError<"Foreign key referenced column list has more entries than the local column list">

export type ValidateFkLocalColumnPairs<
	Pairs extends readonly FkColumnPair[],
	Names extends string,
> = Pairs extends readonly [readonly [infer L extends string, string], ...infer Rest extends readonly FkColumnPair[]]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names>
		: SqlParserError<`Unknown column "${L}" referenced in table constraint`>
	: Pairs extends readonly []
		? true
		: SqlParserError<"Unable to validate foreign key local columns">

export type ValidateFkReferencedColumnPairs<
	Pairs extends readonly FkColumnPair[],
	TargetNames extends string,
> = Pairs extends readonly [readonly [string, infer R extends string], ...infer Rest extends readonly FkColumnPair[]]
	? R extends TargetNames
		? ValidateFkReferencedColumnPairs<Rest, TargetNames>
		: SqlParserError<`Unknown column "${R}" referenced in table constraint`>
	: Pairs extends readonly []
		? true
		: SqlParserError<"Unable to validate foreign key referenced columns">

/** Returns the buffer after the referenced-column `)` (before `ON DELETE`, `;`, etc.). */
export type ParseForeignKeyMetaAndRest<AfterKey extends TokensList> =
	ReadFirstParenGroup<AfterKey> extends [infer LocalBuf extends TokensList, infer R1 extends TokensList]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
				true,
				infer R1b extends TokensList,
			]
			? ReadQualifiedIdentifierFromBuffer<R1b> extends [
					infer Target extends SqlQualifiedIdentifier,
					infer R2 extends TokensList,
				]
				? ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends TokensList, infer R3 extends TokensList]
					? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
						? ParseColumnListToTuple<TargetColsBuf> extends [infer TC extends readonly string[], infer __]
							? ZipColumnListsToPairs<FC, TC> extends infer Pairs
								? Pairs extends SqlParserError<string>
									? [Pairs, R3]
									: Pairs extends readonly FkColumnPair[]
										? Target extends readonly [infer Table extends string]
											? [
													{
														readonly from: ""
														readonly columnPairs: Pairs
														readonly toSchema: undefined
														readonly toTable: Table
													},
													R3,
												]
											: Target extends readonly [
														infer Table extends string,
														infer Schema extends string,
												  ]
												? [
														{
															readonly from: ""
															readonly columnPairs: Pairs
															readonly toSchema: Schema
															readonly toTable: Table
														},
														R3,
													]
												: never
										: [SqlParserError<"Unable to build foreign key column pairs">, R3]
								: [SqlParserError<"Unable to build foreign key column pairs">, R3]
							: [SqlParserError<"Unable to parse referenced column list in foreign key">, R3]
						: [SqlParserError<"Unable to parse local column list in foreign key">, R3]
					: [SqlParserError<"FOREIGN KEY must include a referenced column list">, R2]
				: [SqlParserError<"FOREIGN KEY must specify a referenced table and columns">, R1b]
			: ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
						infer E extends SqlParserError<string>,
						infer R extends TokensList,
				  ]
				? [E, R]
				: [SqlParserError<"FOREIGN KEY must include REFERENCES clause">, R1]
		: [SqlParserError<"FOREIGN KEY must include a local column list">, AfterKey]

type TryReadConstraintHeadUnprefixed<Tokens extends TokensList> = PeekToken<Tokens> extends "primary"
	? PeekToken<SkipToken<Tokens>> extends "key"
		? readonly [
				"yes",
				{
					readonly kind: "primary_key"
					readonly afterKw: SkipToken<SkipToken<Tokens>>
				},
			]
		: readonly ["no", Tokens]
	: PeekToken<Tokens> extends "unique"
		? readonly [
				"yes",
				{
					readonly kind: "unique"
					readonly afterKw: SkipToken<Tokens>
				},
			]
		: PeekToken<Tokens> extends "foreign"
			? PeekToken<SkipToken<Tokens>> extends "key"
				? readonly [
						"yes",
						{
							readonly kind: "foreign_key"
							readonly afterKw: SkipToken<SkipToken<Tokens>>
						},
					]
				: readonly ["no", Tokens]
			: PeekToken<Tokens> extends "check" | "exclude"
				? readonly [
						"yes",
						{
							readonly kind: "other"
							readonly afterKw: SkipToken<Tokens>
						},
					]
				: readonly ["no", Tokens]

type TryReadConstraintHeadAfterConstraintKeyword<R1 extends TokensList> =
	ReadExpectedIdentifier<R1, "Expected constraint name after CONSTRAINT"> extends [
		infer N,
		infer R2 extends TokensList,
	]
		? N extends SqlParserError<string>
			? readonly ["err", N, R2]
			: ReadConstraintKeywordOnStripped<R2> extends [infer Kind extends string, infer AfterKw extends TokensList]
				? readonly [
						"yes",
						{
							readonly kind: Kind
							readonly afterKw: AfterKw
						},
					]
				: readonly [
						"err",
						SqlParserError<"Expected PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, or EXCLUDE after constraint name">,
						R2,
					]
		: readonly [
				"err",
				SqlParserError<"Expected constraint name after CONSTRAINT">,
				R1,
			]

/** Returns `[kind, afterKeyword]` when `EB` is a constraint clause head, or `false` when not matched. */
type ReadConstraintKeywordOnStripped<EB extends TokensList> =
	PeekToken<EB> extends "primary"
		? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after PRIMARY"> extends [
				true,
				infer AfterKey extends TokensList,
			]
			? ["primary_key", AfterKey]
			: false
		: PeekToken<EB> extends "unique"
			? ["unique", SkipToken<EB>]
			: PeekToken<EB> extends "foreign"
				? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after FOREIGN"> extends [
						true,
						infer AfterKey extends TokensList,
					]
					? ["foreign_key", AfterKey]
					: false
				: PeekToken<EB> extends "check" | "exclude" | "constraint"
					? ["other", SkipToken<EB>]
					: false

type ParseFkConstraintEntrySyntaxOnly<AfterKw extends TokensList> = ParseForeignKeyMetaAndRest<AfterKw>
