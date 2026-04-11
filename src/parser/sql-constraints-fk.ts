import type {
	ReadBufferEnd,
	ReadExpectedIdentifier,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadOptionalToken,
	ReadQualifiedIdentifierFromBuffer,
	ReadUntilTopLevelCommaBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { BufferLike, EmptyBuffer, ReadToken, SqlParseError } from "./sql-tokens.js"

export type ForeignRefMeta = {
	from: string
	columnPairs: readonly FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = readonly [local: string, referenced: string]

type StripConstraintPrefixBuffers<B extends BufferLike> =
	ReadOptionalToken<B, "constraint"> extends [true, infer AfterKw extends BufferLike]
		? ReadExpectedIdentifier<AfterKw, "Expected constraint name after CONSTRAINT"> extends [
				infer _Name extends string,
				infer EB extends BufferLike,
			]
			? [EB, EmptyBuffer]
			: [B, EmptyBuffer]
		: [B, EmptyBuffer]

type ReadConstraintKeywordOnStripped<EB extends BufferLike, Original extends BufferLike> =
	ReadToken<EB> extends ["primary", infer R1 extends BufferLike]
		? ReadExpectedToken<R1, "key", "Expected KEY after PRIMARY"> extends [true, infer _]
			? [true, Original]
			: [false, Original]
		: ReadToken<EB> extends ["unique", infer __]
			? [true, Original]
			: ReadToken<EB> extends ["foreign", infer R2 extends BufferLike]
				? ReadExpectedToken<R2, "key", "Expected KEY after FOREIGN"> extends [true, infer ___]
					? [true, Original]
					: [false, Original]
				: ReadToken<EB> extends ["check", infer ____]
					? [true, Original]
					: ReadToken<EB> extends ["exclude", infer _____]
						? [true, Original]
						: ReadToken<EB> extends ["constraint", infer ______]
							? [true, Original]
							: [false, Original]

/** `[true, Rest]` if `Rest` is a constraint clause head; `[false, Rest]` if it is a column definition. `Rest` is always the original fragment buffer (nothing consumed). */
export type ReadConstraintEntryMatch<B extends BufferLike> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends BufferLike, EmptyBuffer]
		? ReadConstraintKeywordOnStripped<EB, B>
		: [false, B]

export type ValidateColumnRefs<B extends BufferLike, Names extends string> =
	ReadToken<B> extends ["", BufferLike]
		? [true, EmptyBuffer]
		: ReadUntilTopLevelCommaBuffer<B> extends [infer HB extends BufferLike, infer TB extends BufferLike]
			? ReadExpectedIdentifier<HB, "Expected column name in constraint list"> extends [
					infer Col extends string,
					infer HBend extends BufferLike,
				]
				? ReadBufferEnd<HBend> extends [true, infer _RestAfterEof extends BufferLike]
					? Col extends Names
						? ValidateColumnRefs<TB, Names> extends [infer R, infer _ extends BufferLike]
							? R extends true
								? [true, EmptyBuffer]
								: [R, EmptyBuffer]
							: never
						: [SqlParseError<`Unknown column "${Col}" referenced in table constraint`>, EmptyBuffer]
					: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]
				: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]
			: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]

export type ParseColumnListToTuple<B extends BufferLike> =
	ReadToken<B> extends ["", BufferLike]
		? [readonly [], EmptyBuffer]
		: ReadUntilTopLevelCommaBuffer<B> extends [infer HB extends BufferLike, infer TB extends BufferLike]
			? ReadExpectedIdentifier<HB, "Expected column name in column list"> extends [
					infer Col extends string,
					infer HBend extends BufferLike,
				]
				? ReadBufferEnd<HBend> extends [true, infer _RestAfterEof extends BufferLike]
					? ParseColumnListToTuple<TB> extends [
							infer Rest extends readonly string[],
							infer _ extends BufferLike,
						]
						? [readonly [Col, ...Rest], EmptyBuffer]
						: never
					: never
				: never
			: never

export type ValidateColumnTupleRefs<Cols extends readonly string[], Names extends string> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Names
		? ValidateColumnTupleRefs<R, Names> extends [infer V, infer _ extends BufferLike]
			? V extends true
				? [true, EmptyBuffer]
				: [V, EmptyBuffer]
			: never
		: [SqlParseError<`Unknown column "${H}" referenced in table constraint`>, EmptyBuffer]
	: Cols extends readonly []
		? [true, EmptyBuffer]
		: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]

export type ZipColumnListsToPairs<
	From extends readonly string[],
	To extends readonly string[],
	Acc extends readonly FkColumnPair[] = readonly [],
> = From extends readonly []
	? To extends readonly []
		? [Acc, EmptyBuffer]
		: [SqlParseError<"Foreign key referenced column list has more entries than the local column list">, EmptyBuffer]
	: To extends readonly []
		? [SqlParseError<"Foreign key local column list has more entries than the referenced column list">, EmptyBuffer]
		: From extends readonly [infer FH extends string, ...infer FT extends readonly string[]]
			? To extends readonly [infer TH extends string, ...infer TT extends readonly string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, readonly [FH, TH]]>
				: [
						SqlParseError<"Foreign key referenced column list has more entries than the local column list">,
						EmptyBuffer,
					]
			: [
					SqlParseError<"Foreign key referenced column list has more entries than the local column list">,
					EmptyBuffer,
				]

export type ValidateFkLocalColumnPairs<
	Pairs extends readonly FkColumnPair[],
	Names extends string,
> = Pairs extends readonly [readonly [infer L extends string, string], ...infer Rest extends readonly FkColumnPair[]]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names> extends [infer R, infer _ extends BufferLike]
			? R extends true
				? [true, EmptyBuffer]
				: [R, EmptyBuffer]
			: never
		: [SqlParseError<`Unknown column "${L}" referenced in table constraint`>, EmptyBuffer]
	: Pairs extends readonly []
		? [true, EmptyBuffer]
		: [SqlParseError<"Unable to validate foreign key local columns">, EmptyBuffer]

export type ValidateFkReferencedColumnPairs<
	Pairs extends readonly FkColumnPair[],
	TargetNames extends string,
> = Pairs extends readonly [readonly [string, infer R extends string], ...infer Rest extends readonly FkColumnPair[]]
	? R extends TargetNames
		? ValidateFkReferencedColumnPairs<Rest, TargetNames> extends [infer V, infer _ extends BufferLike]
			? V extends true
				? [true, EmptyBuffer]
				: [V, EmptyBuffer]
			: never
		: [SqlParseError<`Unknown column "${R}" referenced in table constraint`>, EmptyBuffer]
	: Pairs extends readonly []
		? [true, EmptyBuffer]
		: [SqlParseError<"Unable to validate foreign key referenced columns">, EmptyBuffer]

type ValidateForeignKeyConstraintBodyBuffer<B extends BufferLike, Names extends string> =
	ReadFirstParenGroup<B> extends [infer LocalBuf extends BufferLike, infer R1 extends BufferLike]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
				true,
				infer R1b extends BufferLike,
			]
			? ReadQualifiedIdentifierFromBuffer<R1b> extends [
					infer Target extends SqlQualifiedIdentifier,
					infer R2 extends BufferLike,
				]
				? ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends BufferLike, infer _R3 extends BufferLike]
					? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
						? ParseColumnListToTuple<TargetColsBuf> extends [infer TCt extends readonly string[], infer __]
							? ZipColumnListsToPairs<FC, TCt> extends [infer Pairs, infer ___ extends BufferLike]
								? Pairs extends SqlParseError<string>
									? [Pairs, EmptyBuffer]
									: Pairs extends readonly FkColumnPair[]
										? ValidateFkLocalColumnPairs<Pairs, Names> extends [
												infer V,
												infer ____ extends BufferLike,
											]
											? V extends true
												? [true, EmptyBuffer]
												: [V, EmptyBuffer]
											: never
										: [SqlParseError<"Unable to build foreign key column pairs">, EmptyBuffer]
								: never
							: [SqlParseError<"Unable to parse referenced column list in foreign key">, EmptyBuffer]
						: [SqlParseError<"Unable to parse local column list in foreign key">, EmptyBuffer]
					: [SqlParseError<"FOREIGN KEY must include a referenced column list">, EmptyBuffer]
				: [SqlParseError<"FOREIGN KEY must specify a referenced table and columns">, EmptyBuffer]
			: [SqlParseError<"FOREIGN KEY must include REFERENCES clause">, EmptyBuffer]
		: [SqlParseError<"FOREIGN KEY must include a local column list">, EmptyBuffer]

export type ValidateConstraintRefs<B extends BufferLike, Names extends string> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends BufferLike, EmptyBuffer]
		? ReadToken<EB> extends ["primary", infer Rpk extends BufferLike]
			? ReadExpectedToken<Rpk, "key", "Expected KEY after PRIMARY"> extends [
					true,
					infer AfterPk extends BufferLike,
				]
				? ReadFirstParenGroup<AfterPk> extends [infer Gr extends BufferLike, infer _]
					? ValidateColumnRefs<Gr, Names>
					: [SqlParseError<"PRIMARY KEY must include a column list">, EmptyBuffer]
				: [true, EmptyBuffer]
			: ReadToken<EB> extends ["unique", infer Ru extends BufferLike]
				? ReadFirstParenGroup<Ru> extends [infer Gu extends BufferLike, infer __]
					? ValidateColumnRefs<Gu, Names>
					: [SqlParseError<"UNIQUE must include a column list">, EmptyBuffer]
				: ReadToken<EB> extends ["foreign", infer Rf extends BufferLike]
					? ReadExpectedToken<Rf, "key", "Expected KEY after FOREIGN"> extends [true, infer ___]
						? ValidateForeignKeyConstraintBodyBuffer<EB, Names>
						: [true, EmptyBuffer]
					: [true, EmptyBuffer]
		: [true, EmptyBuffer]

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
			EmptyBuffer,
		]
	: Target extends readonly [infer Table extends string, infer Schema extends string]
		? [
				{
					readonly from: ""
					readonly columnPairs: Pairs
					readonly toSchema: Schema
					readonly toTable: Table
				},
				EmptyBuffer,
			]
		: never

type ParseForeignRefMetaFkTail<
	LocalBuf extends BufferLike,
	Target extends SqlQualifiedIdentifier,
	R2 extends BufferLike,
> =
	ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends BufferLike, infer _R3 extends BufferLike]
		? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
			? ParseColumnListToTuple<TargetColsBuf> extends [infer TC extends readonly string[], infer __]
				? ZipColumnListsToPairs<FC, TC> extends [infer Pairs, infer ___ extends BufferLike]
					? Pairs extends SqlParseError<string>
						? never
						: Pairs extends readonly FkColumnPair[]
							? ParseForeignRefMetaBuildMeta<Target, Pairs>
							: never
					: never
				: never
			: never
		: never

type ParseForeignRefMetaAfterStrip<EB extends BufferLike> =
	ReadToken<EB> extends ["foreign", infer Rfk extends BufferLike]
		? ReadExpectedToken<Rfk, "key", "Expected KEY after FOREIGN"> extends [true, infer _]
			? ReadFirstParenGroup<EB> extends [infer LocalBuf extends BufferLike, infer R1 extends BufferLike]
				? ReadExpectedToken<R1, "references", "Expected REFERENCES"> extends [
						true,
						infer R1b extends BufferLike,
					]
					? ReadQualifiedIdentifierFromBuffer<R1b> extends [
							infer Target extends SqlQualifiedIdentifier,
							infer R2 extends BufferLike,
						]
						? ParseForeignRefMetaFkTail<LocalBuf, Target, R2>
						: never
					: never
				: never
			: never
		: never

export type ParseForeignRefMeta<B extends BufferLike> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends BufferLike, EmptyBuffer]
		? ParseForeignRefMetaAfterStrip<EB>
		: never
