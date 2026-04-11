import type {
	ReadBufferEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { TokensList, EmptyTokenList, PeekToken, SkipToken, SqlParseError } from "./sql-tokens.js"

export type ForeignRefMeta = {
	from: string
	columnPairs: readonly FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = readonly [local: string, referenced: string]

type StripConstraintPrefixBuffers<B extends TokensList> =
	ReadOptionalToken<B, "constraint"> extends [true, infer AfterKw extends TokensList]
		? ReadExpectedIdentifier<AfterKw, "Expected constraint name after CONSTRAINT"> extends [
				infer _Name extends string,
				infer EB extends TokensList,
			]
			? [EB, EmptyTokenList]
			: [B, EmptyTokenList]
		: [B, EmptyTokenList]

type ReadConstraintKeywordOnStripped<EB extends TokensList, Original extends TokensList> =
	PeekToken<EB> extends "primary"
		? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after PRIMARY"> extends [true, infer _]
			? [true, Original]
			: [false, Original]
		: PeekToken<EB> extends "unique"
			? [true, Original]
			: PeekToken<EB> extends "foreign"
				? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after FOREIGN"> extends [true, infer _]
					? [true, Original]
					: [false, Original]
				: PeekToken<EB> extends "check" | "exclude" | "constraint"
					? [true, Original]
					: [false, Original]

/** `[true, Rest]` if `Rest` is a constraint clause head; `[false, Rest]` if it is a column definition. `Rest` is always the original fragment buffer (nothing consumed). */
export type ReadConstraintEntryMatch<B extends TokensList> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends TokensList, EmptyTokenList]
		? ReadConstraintKeywordOnStripped<EB, B>
		: [false, B]

export type ValidateColumnRefs<B extends TokensList, Names extends string> =
	PeekToken<B> extends ""
		? [true, EmptyTokenList]
		: ReadExpectedIdentifier<B, "Expected column name in constraint list"> extends [
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
					: [SqlParseError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
				: PeekToken<AfterId> extends "" | ")"
					? Col extends Names
						? [true, EmptyTokenList]
						: [SqlParseError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
					: ReadBufferEnd<AfterId> extends [true, infer _]
						? Col extends Names
							? [true, EmptyTokenList]
							: [SqlParseError<`Unknown column "${Col}" referenced in table constraint`>, EmptyTokenList]
						: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyTokenList]
			: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyTokenList]

export type ParseColumnListToTuple<B extends TokensList> =
	PeekToken<B> extends ""
		? [readonly [], EmptyTokenList]
		: ReadExpectedIdentifier<B, "Expected column name in column list"> extends [
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
					: ReadBufferEnd<AfterId> extends [true, infer _]
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
		: [SqlParseError<`Unknown column "${H}" referenced in table constraint`>, EmptyTokenList]
	: Cols extends readonly []
		? [true, EmptyTokenList]
		: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyTokenList]

export type ZipColumnListsToPairs<
	From extends readonly string[],
	To extends readonly string[],
	Acc extends readonly FkColumnPair[] = readonly [],
> = From extends readonly []
	? To extends readonly []
		? [Acc, EmptyTokenList]
		: [
				SqlParseError<"Foreign key referenced column list has more entries than the local column list">,
				EmptyTokenList,
			]
	: To extends readonly []
		? [
				SqlParseError<"Foreign key local column list has more entries than the referenced column list">,
				EmptyTokenList,
			]
		: From extends readonly [infer FH extends string, ...infer FT extends readonly string[]]
			? To extends readonly [infer TH extends string, ...infer TT extends readonly string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, readonly [FH, TH]]>
				: [
						SqlParseError<"Foreign key referenced column list has more entries than the local column list">,
						EmptyTokenList,
					]
			: [
					SqlParseError<"Foreign key referenced column list has more entries than the local column list">,
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
		: [SqlParseError<`Unknown column "${L}" referenced in table constraint`>, EmptyTokenList]
	: Pairs extends readonly []
		? [true, EmptyTokenList]
		: [SqlParseError<"Unable to validate foreign key local columns">, EmptyTokenList]

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
		: [SqlParseError<`Unknown column "${R}" referenced in table constraint`>, EmptyTokenList]
	: Pairs extends readonly []
		? [true, EmptyTokenList]
		: [SqlParseError<"Unable to validate foreign key referenced columns">, EmptyTokenList]

type ValidateForeignKeyConstraintBodyBuffer<B extends TokensList, Names extends string> =
	ReadFirstParenGroup<B> extends [infer LocalBuf extends TokensList, infer R1 extends TokensList]
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
								? Pairs extends SqlParseError<string>
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
										: [SqlParseError<"Unable to build foreign key column pairs">, EmptyTokenList]
								: never
							: [SqlParseError<"Unable to parse referenced column list in foreign key">, EmptyTokenList]
						: [SqlParseError<"Unable to parse local column list in foreign key">, EmptyTokenList]
					: [SqlParseError<"FOREIGN KEY must include a referenced column list">, EmptyTokenList]
				: [SqlParseError<"FOREIGN KEY must specify a referenced table and columns">, EmptyTokenList]
			: [SqlParseError<"FOREIGN KEY must include REFERENCES clause">, EmptyTokenList]
		: [SqlParseError<"FOREIGN KEY must include a local column list">, EmptyTokenList]

export type ValidateConstraintRefs<B extends TokensList, Names extends string> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends TokensList, EmptyTokenList]
		? PeekToken<EB> extends "primary"
			? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after PRIMARY"> extends [
					true,
					infer AfterPk extends TokensList,
				]
				? ReadFirstParenGroup<AfterPk> extends [infer Gr extends TokensList, infer _]
					? ValidateColumnRefs<Gr, Names>
					: [SqlParseError<"PRIMARY KEY must include a column list">, EmptyTokenList]
				: [true, EmptyTokenList]
			: PeekToken<EB> extends "unique"
				? ReadFirstParenGroup<SkipToken<EB>> extends [infer Gu extends TokensList, infer _]
					? ValidateColumnRefs<Gu, Names>
					: [SqlParseError<"UNIQUE must include a column list">, EmptyTokenList]
				: PeekToken<EB> extends "foreign"
					? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after FOREIGN"> extends [true, infer _]
						? ValidateForeignKeyConstraintBodyBuffer<EB, Names>
						: [true, EmptyTokenList]
					: [true, EmptyTokenList]
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
					? Pairs extends SqlParseError<string>
						? never
						: Pairs extends readonly FkColumnPair[]
							? ParseForeignRefMetaBuildMeta<Target, Pairs>
							: never
					: never
				: never
			: never
		: never

type ParseForeignRefMetaAfterStrip<EB extends TokensList> =
	PeekToken<EB> extends "foreign"
		? ReadExpectedToken<SkipToken<EB>, "key", "Expected KEY after FOREIGN"> extends [true, infer _]
			? ReadFirstParenGroup<EB> extends [infer LocalBuf extends TokensList, infer R1 extends TokensList]
				? ReadExpectedToken<R1, "references", "Expected REFERENCES"> extends [
						true,
						infer R1b extends TokensList,
					]
					? ReadQualifiedIdentifierFromBuffer<R1b> extends [
							infer Target extends SqlQualifiedIdentifier,
							infer R2 extends TokensList,
						]
						? ParseForeignRefMetaFkTail<LocalBuf, Target, R2>
						: never
					: never
				: never
			: never
		: never

export type ParseForeignRefMeta<B extends TokensList> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends TokensList, EmptyTokenList]
		? ParseForeignRefMetaAfterStrip<EB>
		: never
