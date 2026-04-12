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

/** Strips any optional `CONSTRAINT name` prefix and returns the buffer starting at the constraint type keyword. Returns the original buffer if no such prefix is present or if parsing the name fails. */
type StripConstraintPrefixBuffer<Tokens extends TokensList> =
	ReadOptionalToken<Tokens, "constraint"> extends [true, infer AfterKw extends TokensList]
		? ReadExpectedIdentifier<AfterKw, "Expected constraint name after CONSTRAINT"> extends [
				infer _Name extends string,
				infer EB extends TokensList,
			]
			? EB
			: Tokens
		: Tokens

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
 * `[Kind, AfterKw]` when matched — `Kind` is the constraint type (`"primary_key"` | `"unique"` | `"foreign_key"` | `"other"`), `AfterKw` is the buffer after all constraint type keywords, ready for body parsing.
 * `[false, Tokens]` when not matched — `Tokens` is the original buffer (column definition start), unchanged.
 */
export type ReadConstraintEntryMatch<Tokens extends TokensList> =
	ReadConstraintKeywordOnStripped<StripConstraintPrefixBuffer<Tokens>> extends [
		infer Kind extends string,
		infer AfterKw extends TokensList,
	]
		? [Kind, AfterKw]
		: [false, Tokens]

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

/**
 * Parses the body of a table constraint and validates column refs against `Names`.
 * `Kind` and `AfterKw` come from `ReadConstraintEntryMatch`; the constraint-type keywords have
 * already been consumed, so `AfterKw` points straight at the body.
 *
 * Returns `[result, rest]` where `rest` is the actual buffer after the constraint body —
 * pass it to `SkipStatement` to advance past any trailing options (e.g. `ON DELETE CASCADE`,
 * `DEFERRABLE`) to the next comma or end.
 *
 * - `"primary_key"` / `"unique"`: `result` is `true` on success or `SqlParserError`.
 * - `"foreign_key"`:              `result` is `ForeignRefMeta` on success or `SqlParserError`.
 * - `"other"`:                    `result` is `true`; `rest` = `AfterKw` (body left to `SkipStatement`).
 */
export type ParseConstraintEntry<
	Kind extends string,
	AfterKw extends TokensList,
	Names extends string,
> = Kind extends "primary_key"
	? ReadFirstParenGroup<AfterKw> extends [infer Inner extends TokensList, infer AfterClose extends TokensList]
		? ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
			? ValidateColumnTupleRefs<Cols, Names> extends [infer V, infer _unused extends TokensList]
				? V extends true
					? [true, AfterClose]
					: [V, AfterClose]
				: [SqlParserError<"Unable to validate PRIMARY KEY column refs">, AfterClose]
			: [SqlParserError<"Unable to parse PRIMARY KEY column list">, AfterClose]
		: [SqlParserError<"PRIMARY KEY must include a column list">, AfterKw]
	: Kind extends "unique"
		? ReadFirstParenGroup<AfterKw> extends [infer Inner extends TokensList, infer AfterClose extends TokensList]
			? ParseColumnListToTuple<Inner> extends [infer Cols extends readonly string[], infer _]
				? ValidateColumnTupleRefs<Cols, Names> extends [infer V, infer _unused extends TokensList]
					? V extends true
						? [true, AfterClose]
						: [V, AfterClose]
					: [SqlParserError<"Unable to validate UNIQUE column refs">, AfterClose]
				: [SqlParserError<"Unable to parse UNIQUE column list">, AfterClose]
			: [SqlParserError<"UNIQUE must include a column list">, AfterKw]
		: Kind extends "foreign_key"
			? ParseFkConstraintEntry<AfterKw, Names>
			: [true, AfterKw]

/** Parses a `FOREIGN KEY (local_cols) REFERENCES table (ref_cols)` body, validates local column refs, and returns `[ForeignRefMeta | error, rest]`. */
type ParseFkConstraintEntry<AfterKw extends TokensList, Names extends string> =
	ParseForeignKeyMetaAndRest<AfterKw> extends [infer Result, infer FkRest extends TokensList]
		? Result extends ForeignRefMeta
			? ValidateFkLocalColumnPairs<Result["columnPairs"], Names> extends [infer V, infer _unused extends TokensList]
				? V extends true
					? [Result, FkRest]
					: [V, FkRest]
				: [SqlParserError<"Unable to validate FK local column refs">, FkRest]
			: [Result, FkRest]
		: [SqlParserError<"Unable to parse FOREIGN KEY constraint">, AfterKw]

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
