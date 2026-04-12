import type {
	IsBufferEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParserError } from "./sql-tokens.js"

export type ForeignRefMeta = {
	from: string
	columnPairs: readonly FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = readonly [local: string, referenced: string]

type StripConstraintPrefixBuffers<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "constraint"> extends [true, infer AfterKw extends TokensList]
		? ReadExpectedIdentifier<AfterKw, "Expected constraint name after CONSTRAINT"> extends [
				infer _Name extends string,
				infer EB extends TokensList,
			]
			? [EB, EmptyTokenList]
			: [Tokens, EmptyTokenList]
		: [Tokens, EmptyTokenList]

/** Returns `[kind, afterKeyword]` when `EB` is a constraint clause head, or `false` otherwise. `afterKeyword` is the buffer after all constraint type keywords (e.g. after `PRIMARY KEY`, after `UNIQUE`), ready for body parsing without re-extracting those tokens. */
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

/**
 * `[Kind, EB, AfterKw]` when matched — `Kind` is the constraint type (`"primary_key"` | `"unique"` | `"foreign_key"` | `"other"`), `EB` is the stripped buffer (after any `CONSTRAINT name` prefix), `AfterKw` is the buffer after all constraint type keywords, ready for body parsing.
 * `[false, Tokens, Tokens]` when not matched — `Tokens` is the original buffer (column definition start).
 */
export type ReadConstraintEntryMatch<Tokens extends TokensList> =
	StripConstraintPrefixBuffers<Tokens> extends [infer EB extends TokensList, EmptyTokenList]
		? ReadConstraintKeywordOnStripped<EB> extends [infer Kind extends string, infer AfterKw extends TokensList]
			? [Kind, EB, AfterKw]
			: [false, Tokens, Tokens]
		: [false, Tokens, Tokens]

export type ValidateColumnRefs<Tokens extends TokensList, Names extends string> =
	PeekToken<Tokens> extends ""
		? [true, EmptyTokenList]
		: ReadExpectedIdentifier<Tokens, "Expected column name in constraint list"> extends [
					infer Col extends string,
					infer AfterId extends TokensList,
			  ]
			? PeekToken<AfterId> extends ","
				? Col extends Names
					? ValidateColumnRefs<SkipToken<AfterId>, Names> extends [infer R, infer _ extends TokensList]
						? R extends true
							? [true, EmptyTokenList]
							: [R, EmptyTokenList]
						: never
					: [SqlParserError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
				: PeekToken<AfterId> extends "" | ")"
					? Col extends Names
						? [true, EmptyTokenList]
						: [SqlParserError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
					: IsBufferEnd<AfterId> extends true
						? Col extends Names
							? [true, EmptyTokenList]
							: [SqlParserError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
						: [SqlParserError<"Unable to parse column reference list in table constraint">, EmptyTokenList]
			: [SqlParserError<"Unable to parse column reference list in table constraint">, EmptyTokenList]

export type ParseColumnListToTuple<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [readonly [], EmptyTokenList]
		: ReadExpectedIdentifier<Tokens, "Expected column name in column list"> extends [
					infer Col extends string,
					infer AfterId extends TokensList,
			  ]
			? PeekToken<AfterId> extends ","
				? ParseColumnListToTuple<SkipToken<AfterId>> extends [
						infer Rest extends readonly string[],
						infer _ extends TokensList,
					]
					? [readonly [Col, ...Rest], EmptyTokenList]
					: never
				: PeekToken<AfterId> extends "" | ")"
					? [readonly [Col], EmptyTokenList]
					: IsBufferEnd<AfterId> extends true
						? [readonly [Col], EmptyTokenList]
						: never
			: never

export type ValidateColumnTupleRefs<Cols extends readonly string[], Names extends string> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Names
		? ValidateColumnTupleRefs<R, Names> extends [infer V, infer _ extends TokensList]
			? V extends true
				? [true, EmptyTokenList]
				: [V, EmptyTokenList]
			: never
		: [SqlParserError<`Unknown column "${H}" referenced in table constraint`>, EmptyTokenList]
	: Cols extends readonly []
		? [true, EmptyTokenList]
		: [SqlParserError<"Unable to parse column reference list in table constraint">, EmptyTokenList]

export type ZipColumnListsToPairs<
	From extends readonly string[],
	To extends readonly string[],
	Acc extends readonly FkColumnPair[] = readonly [],
> = From extends readonly []
	? To extends readonly []
		? [Acc, EmptyTokenList]
		: [
				SqlParserError<"Foreign key referenced column list has more entries than the local column list">,
				EmptyTokenList,
			]
	: To extends readonly []
		? [
				SqlParserError<"Foreign key local column list has more entries than the referenced column list">,
				EmptyTokenList,
			]
		: From extends readonly [infer FH extends string, ...infer FT extends readonly string[]]
			? To extends readonly [infer TH extends string, ...infer TT extends readonly string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, readonly [FH, TH]]>
				: [
						SqlParserError<"Foreign key referenced column list has more entries than the local column list">,
						EmptyTokenList,
					]
			: [
					SqlParserError<"Foreign key referenced column list has more entries than the local column list">,
					EmptyTokenList,
				]

export type ValidateFkLocalColumnPairs<
	Pairs extends readonly FkColumnPair[],
	Names extends string,
> = Pairs extends readonly [readonly [infer L extends string, string], ...infer Rest extends readonly FkColumnPair[]]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names> extends [infer R, infer _ extends TokensList]
			? R extends true
				? [true, EmptyTokenList]
				: [R, EmptyTokenList]
			: never
		: [SqlParserError<`Unknown column "${L}" referenced in table constraint`>, EmptyTokenList]
	: Pairs extends readonly []
		? [true, EmptyTokenList]
		: [SqlParserError<"Unable to validate foreign key local columns">, EmptyTokenList]

export type ValidateFkReferencedColumnPairs<
	Pairs extends readonly FkColumnPair[],
	TargetNames extends string,
> = Pairs extends readonly [readonly [string, infer R extends string], ...infer Rest extends readonly FkColumnPair[]]
	? R extends TargetNames
		? ValidateFkReferencedColumnPairs<Rest, TargetNames> extends [infer V, infer _ extends TokensList]
			? V extends true
				? [true, EmptyTokenList]
				: [V, EmptyTokenList]
			: never
		: [SqlParserError<`Unknown column "${R}" referenced in table constraint`>, EmptyTokenList]
	: Pairs extends readonly []
		? [true, EmptyTokenList]
		: [SqlParserError<"Unable to validate foreign key referenced columns">, EmptyTokenList]

/** `Tokens` must be the buffer immediately after `FOREIGN KEY` — pointing at `(local_col_list)`. */
type ValidateForeignKeyConstraintBodyBuffer<Tokens extends TokensList, Names extends string> =
	ReadFirstParenGroup<Tokens> extends [infer LocalBuf extends TokensList, infer R1 extends TokensList]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
				true,
				infer R1b extends TokensList,
			]
			? ReadQualifiedIdentifierFromBuffer<R1b> extends [
					infer Target extends SqlQualifiedIdentifier,
					infer R2 extends TokensList,
				]
				? ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends TokensList, infer _R3 extends TokensList]
					? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
						? ParseColumnListToTuple<TargetColsBuf> extends [infer TCt extends readonly string[], infer __]
							? ZipColumnListsToPairs<FC, TCt> extends [infer Pairs, infer ___ extends TokensList]
								? Pairs extends SqlParserError<string>
									? [Pairs, EmptyTokenList]
									: Pairs extends readonly FkColumnPair[]
										? ValidateFkLocalColumnPairs<Pairs, Names> extends [
												infer V,
												infer ____ extends TokensList,
											]
											? V extends true
												? [true, EmptyTokenList]
												: [V, EmptyTokenList]
											: never
										: [SqlParserError<"Unable to build foreign key column pairs">, EmptyTokenList]
								: never
							: [SqlParserError<"Unable to parse referenced column list in foreign key">, EmptyTokenList]
						: [SqlParserError<"Unable to parse local column list in foreign key">, EmptyTokenList]
					: [SqlParserError<"FOREIGN KEY must include a referenced column list">, EmptyTokenList]
				: [SqlParserError<"FOREIGN KEY must specify a referenced table and columns">, EmptyTokenList]
			: [SqlParserError<"FOREIGN KEY must include REFERENCES clause">, EmptyTokenList]
		: [SqlParserError<"FOREIGN KEY must include a local column list">, EmptyTokenList]

/**
 * Caller must pass `Kind` and `AfterKw` from `ReadConstraintEntryMatch` — tokens for the constraint type keywords have already been extracted once (no re-extraction here).
 * `AfterKw` is the buffer immediately after the constraint type keywords, e.g. after `PRIMARY KEY`, pointing at `(col_list)`.
 */
export type ValidateConstraintRefs<
	Kind extends string,
	AfterKw extends TokensList,
	Names extends string,
> = Kind extends "primary_key"
	? ReadFirstParenGroup<AfterKw> extends [infer Gr extends TokensList, infer _]
		? ValidateColumnRefs<Gr, Names>
		: [SqlParserError<"PRIMARY KEY must include a column list">, EmptyTokenList]
	: Kind extends "unique"
		? ReadFirstParenGroup<AfterKw> extends [infer Gu extends TokensList, infer _]
			? ValidateColumnRefs<Gu, Names>
			: [SqlParserError<"UNIQUE must include a column list">, EmptyTokenList]
		: Kind extends "foreign_key"
			? ValidateForeignKeyConstraintBodyBuffer<AfterKw, Names>
			: [true, EmptyTokenList]

type ParseForeignRefMetaBuildMeta<
	Target extends SqlQualifiedIdentifier,
	Pairs extends readonly FkColumnPair[],
> = Target extends readonly [infer Table extends string]
	? [
			{
				readonly from: ""
				readonly columnPairs: Pairs
				readonly toSchema: undefined
				readonly toTable: Table
			},
			EmptyTokenList,
		]
	: Target extends readonly [infer Table extends string, infer Schema extends string]
		? [
				{
					readonly from: ""
					readonly columnPairs: Pairs
					readonly toSchema: Schema
					readonly toTable: Table
				},
				EmptyTokenList,
			]
		: never

type ParseForeignRefMetaFkTail<
	LocalBuf extends TokensList,
	Target extends SqlQualifiedIdentifier,
	R2 extends TokensList,
> =
	ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends TokensList, infer _R3 extends TokensList]
		? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
			? ParseColumnListToTuple<TargetColsBuf> extends [infer TC extends readonly string[], infer __]
				? ZipColumnListsToPairs<FC, TC> extends [infer Pairs, infer ___ extends TokensList]
					? Pairs extends SqlParserError<string>
						? never
						: Pairs extends readonly FkColumnPair[]
							? ParseForeignRefMetaBuildMeta<Target, Pairs>
							: never
					: never
				: never
			: never
		: never

/** `AfterKey` must be the buffer immediately after `FOREIGN KEY` — pointing at `(local_col_list)`. */
type ParseForeignRefMetaAfterKey<AfterKey extends TokensList> =
	ReadFirstParenGroup<AfterKey> extends [infer LocalBuf extends TokensList, infer R1 extends TokensList]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES"> extends [true, infer R1b extends TokensList]
			? ReadQualifiedIdentifierFromBuffer<R1b> extends [
					infer Target extends SqlQualifiedIdentifier,
					infer R2 extends TokensList,
				]
				? ParseForeignRefMetaFkTail<LocalBuf, Target, R2>
				: never
			: never
		: never

/**
 * Caller must pass `Kind` and `AfterKw` from `ReadConstraintEntryMatch`.
 * Returns FK metadata when `Kind` is `"foreign_key"`, otherwise `never`.
 */
export type ParseForeignRefMeta<Kind extends string, AfterKw extends TokensList> = Kind extends "foreign_key"
	? ParseForeignRefMetaAfterKey<AfterKw>
	: never

/** Like {@link ParseForeignRefMeta} but returns the buffer after the referenced-column `)` (before `ON DELETE`, `;`, etc.). */
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
							? ZipColumnListsToPairs<FC, TC> extends [infer Pairs, infer ___ extends TokensList]
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
