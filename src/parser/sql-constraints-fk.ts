import type { SqlParseError } from "../sql-types.js";
import type {
	FirstParenGroup,
	ReadIdentifier,
	ReadUntilTopLevelComma,
	StripIdentifierQuotes,
	Trim,
	ToLower,
} from "./sql-parse-primitives.js";

type StripConstraintPrefix<S extends string> = ToLower<Trim<S>> extends `constraint ${infer Rest}`
	? ReadIdentifier<Trim<Rest>> extends [string, infer AfterName extends string]
		? Trim<ToLower<AfterName>>
		: ToLower<Trim<S>>
	: ToLower<Trim<S>>;
export type IsConstraintEntry<S extends string> = StripConstraintPrefix<S> extends
	| `primary key${string}`
	| `unique${string}`
	| `foreign key${string}`
	| `check${string}`
	| `exclude${string}`
	| `constraint ${string}`
	? true
	: false;

export type ValidateColumnRefs<List extends string, Names extends string> = Trim<List> extends ""
	? true
	: ReadUntilTopLevelComma<List> extends [infer Head extends string, infer Tail extends string]
		? StripIdentifierQuotes<Trim<Head>> extends Names
			? ValidateColumnRefs<Tail, Names>
			: SqlParseError<`Unknown column "${StripIdentifierQuotes<Trim<Head>>}" referenced in table constraint`>
		: SqlParseError<"Unable to parse column reference list in table constraint">;

/** Top-level comma-separated identifiers → readonly tuple of stripped names (`never` if unparseable). */
export type ParseColumnListToTuple<List extends string> = Trim<List> extends ""
	? readonly []
	: ReadUntilTopLevelComma<List> extends [infer Head extends string, infer Tail extends string]
		? ParseColumnListToTuple<Tail> extends infer Rest extends readonly string[]
			? readonly [StripIdentifierQuotes<Trim<Head>>, ...Rest]
			: never
		: never;

export type ValidateColumnTupleRefs<Cols extends readonly string[], Names extends string> = Cols extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Names
		? ValidateColumnTupleRefs<R, Names>
		: SqlParseError<`Unknown column "${H}" referenced in table constraint`>
	: Cols extends readonly []
		? true
		: SqlParseError<"Unable to parse column reference list in table constraint">;

/** One `(local_column, referenced_column)` mapping in a foreign key. */
export type FkColumnPair = readonly [local: string, referenced: string];

/**
 * Zip two parsed column lists into aligned pairs; same arity rules as SQL.
 * On mismatch returns `SqlParseError<…>`; on success a readonly tuple of pairs.
 */
export type ZipColumnListsToPairs<
	From extends readonly string[],
	To extends readonly string[],
	Acc extends readonly FkColumnPair[] = [],
> = From extends readonly []
	? To extends readonly []
		? Acc
		: SqlParseError<"Foreign key referenced column list has more entries than the local column list">
	: To extends readonly []
		? SqlParseError<"Foreign key local column list has more entries than the referenced column list">
		: From extends readonly [infer FH extends string, ...infer FT extends readonly string[]]
			? To extends readonly [infer TH extends string, ...infer TT extends readonly string[]]
				? ZipColumnListsToPairs<FT, TT, [...Acc, readonly [FH, TH]]>
				: SqlParseError<"Foreign key referenced column list has more entries than the local column list">
			: SqlParseError<"Foreign key referenced column list has more entries than the local column list">;

export type ValidateFkLocalColumnPairs<Pairs extends readonly FkColumnPair[], Names extends string> = Pairs extends readonly [
	readonly [infer L extends string, string],
	...infer Rest extends readonly FkColumnPair[],
]
	? L extends Names
		? ValidateFkLocalColumnPairs<Rest, Names>
		: SqlParseError<`Unknown column "${L}" referenced in table constraint`>
	: Pairs extends readonly []
		? true
		: SqlParseError<"Unable to validate foreign key local columns">;

export type ValidateFkReferencedColumnPairs<Pairs extends readonly FkColumnPair[], TargetNames extends string> = Pairs extends readonly [
	readonly [string, infer R extends string],
	...infer Rest extends readonly FkColumnPair[],
]
	? R extends TargetNames
		? ValidateFkReferencedColumnPairs<Rest, TargetNames>
		: SqlParseError<`Unknown column "${R}" referenced in table constraint`>
	: Pairs extends readonly []
		? true
		: SqlParseError<"Unable to validate foreign key referenced columns">;

/** FK body after `StripConstraintPrefix`: zip local/referenced lists, then validate local names. */
type ValidateForeignKeyConstraintBody<E extends string, Names extends string> = E extends `foreign key${string}`
	? FirstParenGroup<E> extends infer G extends string
		? E extends `${string}references ${infer AfterRef}`
			? ReadIdentifier<Trim<AfterRef>> extends [infer _TR extends string, infer RestAfterTarget extends string]
				? FirstParenGroup<RestAfterTarget> extends infer TC extends string
					? [ParseColumnListToTuple<G>] extends [never]
						? SqlParseError<"Unable to parse local column list in foreign key">
						: [ParseColumnListToTuple<TC>] extends [never]
							? SqlParseError<"Unable to parse referenced column list in foreign key">
							: ParseColumnListToTuple<G> extends infer FromT extends readonly string[]
								? ParseColumnListToTuple<TC> extends infer ToT extends readonly string[]
									? ZipColumnListsToPairs<FromT, ToT> extends infer Pairs
										? Pairs extends SqlParseError<string>
											? Pairs
											: Pairs extends readonly FkColumnPair[]
												? ValidateFkLocalColumnPairs<Pairs, Names>
												: SqlParseError<"Unable to build foreign key column pairs">
										: SqlParseError<"Unable to build foreign key column pairs">
									: SqlParseError<"Unable to parse referenced column list in foreign key">
								: SqlParseError<"Unable to parse local column list in foreign key">
					: SqlParseError<"FOREIGN KEY must include a referenced column list">
				: SqlParseError<"FOREIGN KEY must specify a referenced table and columns">
			: SqlParseError<"FOREIGN KEY must include REFERENCES clause">
		: SqlParseError<"FOREIGN KEY must include a local column list">
	: true;

export type ValidateConstraintRefs<Entry extends string, Names extends string> = StripConstraintPrefix<Entry> extends infer E extends string
	? E extends `primary key${string}`
		? FirstParenGroup<E> extends infer G extends string
			? ValidateColumnRefs<G, Names>
			: SqlParseError<"PRIMARY KEY must include a column list">
		: E extends `unique${string}`
			? FirstParenGroup<E> extends infer G extends string
				? ValidateColumnRefs<G, Names>
				: SqlParseError<"UNIQUE must include a column list">
			: E extends `foreign key${string}`
				? ValidateForeignKeyConstraintBody<E, Names>
				: true
	: true;

type ParseQualifiedRefTable<T extends string> = StripIdentifierQuotes<T> extends `${infer Schema}.${infer Table}`
	? { schema: Schema; table: Table }
	: { schema: never; table: StripIdentifierQuotes<T> };

export type ForeignRefMeta = {
	from: string;
	columnPairs: readonly FkColumnPair[];
	toSchema: string | never;
	toTable: string;
};

export type ParseForeignRefMeta<Entry extends string> = StripConstraintPrefix<Entry> extends infer E extends string
	? E extends `foreign key${string}`
		? FirstParenGroup<E> extends infer LocalCols extends string
			? E extends `${string}references ${infer AfterRef}`
				? ReadIdentifier<Trim<AfterRef>> extends [infer TargetRaw extends string, infer RestAfterTarget extends string]
					? FirstParenGroup<RestAfterTarget> extends infer TargetCols extends string
						? ParseQualifiedRefTable<TargetRaw> extends infer PQ
							? PQ extends { schema: infer S; table: infer Tab }
								? ParseColumnListToTuple<LocalCols> extends infer FC extends readonly string[]
									? ParseColumnListToTuple<TargetCols> extends infer TC extends readonly string[]
										? ZipColumnListsToPairs<FC, TC> extends infer Pairs
											? Pairs extends readonly FkColumnPair[]
												? { from: never; columnPairs: Pairs; toSchema: S; toTable: Tab }
												: never
											: never
										: never
									: never
								: never
							: never
						: never
					: never
				: never
			: never
		: never
	: never;
