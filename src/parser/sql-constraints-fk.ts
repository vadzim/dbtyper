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
import type { Buffer, EmptyBuffer, ReadToken, SqlParseError } from "./sql-tokens.js"

export type ForeignRefMeta = {
	from: string
	columnPairs: readonly FkColumnPair[]
	toSchema: string | undefined
	toTable: string
}

export type FkColumnPair = readonly [local: string, referenced: string]

type StripConstraintPrefixBuffers<B extends Buffer> = ReadOptionalToken<B, "constraint"> extends [
	true,
	infer AfterKw extends Buffer,
]
	? ReadExpectedIdentifier<AfterKw, "Expected constraint name after CONSTRAINT"> extends [
			infer _Name extends string,
			infer EB extends Buffer,
		]
		? [EB, EmptyBuffer]
		: [B, EmptyBuffer]
	: [B, EmptyBuffer]

type ReadConstraintKeywordOnStripped<EB extends Buffer, Original extends Buffer> =
	ReadToken<EB> extends ["primary", infer R1 extends Buffer]
		? ReadExpectedToken<R1, "key", "Expected KEY after PRIMARY"> extends [true, infer _]
			? [true, Original]
			: [false, Original]
		: ReadToken<EB> extends ["unique", infer __]
			? [true, Original]
			: ReadToken<EB> extends ["foreign", infer R2 extends Buffer]
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
export type ReadConstraintEntryMatch<B extends Buffer> = StripConstraintPrefixBuffers<B> extends [
	infer EB extends Buffer,
	EmptyBuffer,
]
	? ReadConstraintKeywordOnStripped<EB, B>
	: [false, B]

export type ValidateColumnRefs<B extends Buffer, Names extends string> = ReadToken<B> extends ["", Buffer]
	? [true, EmptyBuffer]
	: ReadUntilTopLevelCommaBuffer<B> extends [infer HB extends Buffer, infer TB extends Buffer]
		? ReadExpectedIdentifier<HB, "Expected column name in constraint list"> extends [
				infer Col extends string,
				infer HBend extends Buffer,
			]
			? ReadBufferEnd<HBend> extends [true, infer _RestAfterEof extends Buffer]
				? Col extends Names
					? ValidateColumnRefs<TB, Names> extends [infer R, infer _ extends Buffer]
						? R extends true
							? [true, EmptyBuffer]
							: [R, EmptyBuffer]
						: never
					: [SqlParseError<`Unknown column "${Col}" referenced in table constraint`>, EmptyBuffer]
				: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]
			: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]
		: [SqlParseError<"Unable to parse column reference list in table constraint">, EmptyBuffer]

export type ParseColumnListToTuple<B extends Buffer> = ReadToken<B> extends ["", Buffer]
	? [readonly [], EmptyBuffer]
	: ReadUntilTopLevelCommaBuffer<B> extends [infer HB extends Buffer, infer TB extends Buffer]
		? ReadExpectedIdentifier<HB, "Expected column name in column list"> extends [
				infer Col extends string,
				infer HBend extends Buffer,
			]
			? ReadBufferEnd<HBend> extends [true, infer _RestAfterEof extends Buffer]
				? ParseColumnListToTuple<TB> extends [infer Rest extends readonly string[], infer _ extends Buffer]
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
		? ValidateColumnTupleRefs<R, Names> extends [infer V, infer _ extends Buffer]
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
				: [SqlParseError<"Foreign key referenced column list has more entries than the local column list">, EmptyBuffer]
			: [SqlParseError<"Foreign key referenced column list has more entries than the local column list">, EmptyBuffer]

export type ValidateFkLocalColumnPairs<
	Pairs extends readonly FkColumnPair[],
	Names extends string,
> = Pairs extends readonly [readonly [infer L extends string, string], ...infer Rest extends readonly FkColumnPair[]]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names> extends [infer R, infer _ extends Buffer]
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
		? ValidateFkReferencedColumnPairs<Rest, TargetNames> extends [infer V, infer _ extends Buffer]
			? V extends true
				? [true, EmptyBuffer]
				: [V, EmptyBuffer]
			: never
		: [SqlParseError<`Unknown column "${R}" referenced in table constraint`>, EmptyBuffer]
	: Pairs extends readonly []
		? [true, EmptyBuffer]
		: [SqlParseError<"Unable to validate foreign key referenced columns">, EmptyBuffer]

type ValidateForeignKeyConstraintBodyBuffer<B extends Buffer, Names extends string> =
	ReadFirstParenGroup<B> extends [infer LocalBuf extends Buffer, infer R1 extends Buffer]
		? ReadExpectedToken<R1, "references", "Expected REFERENCES in FOREIGN KEY"> extends [
				true,
				infer R1b extends Buffer,
			]
			? ReadQualifiedIdentifierFromBuffer<R1b> extends [
					infer Target extends SqlQualifiedIdentifier,
					infer R2 extends Buffer,
				]
				? ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends Buffer, infer _R3 extends Buffer]
					? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
						? ParseColumnListToTuple<TargetColsBuf> extends [infer TCt extends readonly string[], infer __]
							? ZipColumnListsToPairs<FC, TCt> extends [infer Pairs, infer ___ extends Buffer]
								? Pairs extends SqlParseError<string>
									? [Pairs, EmptyBuffer]
									: Pairs extends readonly FkColumnPair[]
										? ValidateFkLocalColumnPairs<Pairs, Names> extends [infer V, infer ____ extends Buffer]
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

export type ValidateConstraintRefs<B extends Buffer, Names extends string> =
	StripConstraintPrefixBuffers<B> extends [infer EB extends Buffer, EmptyBuffer]
		? ReadToken<EB> extends ["primary", infer Rpk extends Buffer]
			? ReadExpectedToken<Rpk, "key", "Expected KEY after PRIMARY"> extends [true, infer AfterPk extends Buffer]
				? ReadFirstParenGroup<AfterPk> extends [infer Gr extends Buffer, infer _]
					? ValidateColumnRefs<Gr, Names>
					: [SqlParseError<"PRIMARY KEY must include a column list">, EmptyBuffer]
				: [true, EmptyBuffer]
			: ReadToken<EB> extends ["unique", infer Ru extends Buffer]
				? ReadFirstParenGroup<Ru> extends [infer Gu extends Buffer, infer __]
					? ValidateColumnRefs<Gu, Names>
					: [SqlParseError<"UNIQUE must include a column list">, EmptyBuffer]
				: ReadToken<EB> extends ["foreign", infer Rf extends Buffer]
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
	LocalBuf extends Buffer,
	Target extends SqlQualifiedIdentifier,
	R2 extends Buffer,
> = ReadFirstParenGroup<R2> extends [infer TargetColsBuf extends Buffer, infer _R3 extends Buffer]
	? ParseColumnListToTuple<LocalBuf> extends [infer FC extends readonly string[], infer _]
		? ParseColumnListToTuple<TargetColsBuf> extends [infer TC extends readonly string[], infer __]
			? ZipColumnListsToPairs<FC, TC> extends [infer Pairs, infer ___ extends Buffer]
				? Pairs extends SqlParseError<string>
					? never
					: Pairs extends readonly FkColumnPair[]
						? ParseForeignRefMetaBuildMeta<Target, Pairs>
						: never
				: never
			: never
		: never
	: never

type ParseForeignRefMetaAfterStrip<EB extends Buffer> = ReadToken<EB> extends ["foreign", infer Rfk extends Buffer]
	? ReadExpectedToken<Rfk, "key", "Expected KEY after FOREIGN"> extends [true, infer _]
		? ReadFirstParenGroup<EB> extends [infer LocalBuf extends Buffer, infer R1 extends Buffer]
			? ReadExpectedToken<R1, "references", "Expected REFERENCES"> extends [true, infer R1b extends Buffer]
				? ReadQualifiedIdentifierFromBuffer<R1b> extends [
						infer Target extends SqlQualifiedIdentifier,
						infer R2 extends Buffer,
					]
					? ParseForeignRefMetaFkTail<LocalBuf, Target, R2>
					: never
				: never
			: never
		: never
	: never

export type ParseForeignRefMeta<B extends Buffer> = StripConstraintPrefixBuffers<B> extends [
	infer EB extends Buffer,
	EmptyBuffer,
]
	? ParseForeignRefMetaAfterStrip<EB>
	: never
