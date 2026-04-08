import type { SqlParseError } from "./sql-types.js";

type Ws = " " | "\n" | "\t" | "\r";
type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S;
type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S;
type Trim<S extends string> = TrimLeft<TrimRight<S>>;
type RemoveTrailingSemicolon<S extends string> = Trim<S> extends `${infer X};` ? Trim<X> : Trim<S>;
type ToLower<S extends string> = Lowercase<S>;

type StripLineComment<S extends string> = S extends `${infer _Comment}\n${infer Rest}`
	? `\n${Rest}`
	: S extends `${infer _Comment}\r${infer Rest}`
		? `\r${Rest}`
		: "";
type StripBlockComment<S extends string> = S extends `${infer _Comment}*/${infer Rest}` ? Rest : "";
type StripSqlComments<S extends string> = S extends `${infer Head}--${infer Tail}`
	? StripSqlComments<`${Head}${StripLineComment<Tail>}`>
	: S extends `${infer Head}/*${infer Tail}`
		? StripSqlComments<`${Head}${StripBlockComment<Tail>}`>
		: S;

type ReadDoubleQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends `"`
		? [`"${Acc}"`, Rest]
		: ReadDoubleQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`"${Acc}"`, ""];
type ReadBacktickQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "`"
		? [`\`${Acc}\``, Rest]
		: ReadBacktickQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`\`${Acc}\``, ""];
type ReadBracketQuotedIdentifier<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends "]"
		? [`[${Acc}]`, Rest]
		: ReadBracketQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`[${Acc}]`, ""];
type ReadIdentifier<S extends string> = Trim<S> extends `"${infer Rest}`
	? ReadDoubleQuotedIdentifier<Rest>
	: Trim<S> extends `\`${infer Rest}`
		? ReadBacktickQuotedIdentifier<Rest>
		: Trim<S> extends `[${infer Rest}`
			? ReadBracketQuotedIdentifier<Rest>
			: ReadWord<Trim<S>>;
type ReadWord<S extends string, Acc extends string = ""> = S extends `${infer C}${infer Rest}`
	? C extends Ws | "," | "(" | ")"
		? [Acc, `${C}${Rest}`]
		: ReadWord<Rest, `${Acc}${C}`>
	: [Acc, ""];
type ReadUntilTopLevelComma<
	S extends string,
	Depth extends 0[] = [],
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? ReadUntilTopLevelComma<Rest, [0, ...Depth], `${Acc}${C}`>
		: C extends ")"
			? Depth extends [0, ...infer Tail extends 0[]]
				? ReadUntilTopLevelComma<Rest, Tail, `${Acc}${C}`>
				: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
			: C extends ","
				? Depth["length"] extends 0
					? [Acc, Rest]
					: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
				: ReadUntilTopLevelComma<Rest, Depth, `${Acc}${C}`>
	: [Acc, ""];
type StripIdentifierQuotes<S extends string> = S extends `"${infer X}"`
	? X
	: S extends `\`${infer X}\``
		? X
		: S extends `[${infer X}]`
			? X
			: S;

type FindFirstOpenParen<S extends string> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? Rest
		: FindFirstOpenParen<Rest>
	: never;
type ReadParenContent<
	S extends string,
	Depth extends 0[] = [],
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "("
		? ReadParenContent<Rest, [0, ...Depth], `${Acc}${C}`>
		: C extends ")"
			? Depth extends [0, ...infer Tail extends 0[]]
				? ReadParenContent<Rest, Tail, `${Acc}${C}`>
				: [Acc, Rest]
			: ReadParenContent<Rest, Depth, `${Acc}${C}`>
	: never;
type FirstParenGroup<S extends string> = FindFirstOpenParen<S> extends infer Rest extends string
	? ReadParenContent<Rest> extends [infer Group extends string, string]
		? Group
		: never
	: never;

type NormalizeTypeToken<S extends string> = ToLower<Trim<S>> extends `${infer Base}(${string}` ? Trim<Base> : ToLower<Trim<S>>;
type StripArraySuffix<T extends string> = T extends `${infer Base}[]` ? StripArraySuffix<Base> : T;
type StripSchemaPrefix<T extends string> = T extends `${string}.${infer Name}` ? Name : T;
type NormalizePgTypeToken<T extends string> = StripSchemaPrefix<StripArraySuffix<NormalizeTypeToken<T>>>;
type IsArrayType<T extends string> = NormalizeTypeToken<T> extends `${string}[]` ? true : false;
type SqlScalarTypeToTs<T extends string> = NormalizePgTypeToken<T> extends
	| "int"
	| "integer"
	| "smallint"
	| "bigint"
	| "int2"
	| "int4"
	| "int8"
	| "smallserial"
	| "serial"
	| "bigserial"
	| "serial2"
	| "serial4"
	| "serial8"
	| "float"
	| "double"
	| "float4"
	| "float8"
	| "real"
	| "decimal"
	| "numeric"
	| "money"
	? number
	: NormalizePgTypeToken<T> extends "boolean" | "bool"
		? boolean
		: NormalizePgTypeToken<T> extends "date" | "timestamp" | "time" | "timetz" | "timestamptz" | "interval"
			? Date
			: NormalizePgTypeToken<T> extends "bytea"
				? Uint8Array
				: NormalizePgTypeToken<T> extends "json" | "jsonb"
					? unknown
					: NormalizePgTypeToken<T> extends
								| "point"
								| "line"
								| "lseg"
								| "box"
								| "path"
								| "polygon"
								| "circle"
								| "int4range"
								| "int8range"
								| "numrange"
								| "tsrange"
								| "tstzrange"
								| "daterange"
								| "int4multirange"
								| "int8multirange"
								| "nummultirange"
								| "tsmultirange"
								| "tstzmultirange"
								| "datemultirange"
						? unknown
						: string;
type SqlTypeToTs<T extends string> = IsArrayType<T> extends true ? SqlScalarTypeToTs<T>[] : SqlScalarTypeToTs<T>;

type IsNullable<ColumnSpec extends string> = ToLower<ColumnSpec> extends `${string} not null${string}` ? false : true;
type ParseColumn<Col extends string> = ReadIdentifier<Trim<Col>> extends [infer ColName extends string, infer Rest extends string]
	? ReadWord<Trim<Rest>> extends [infer SqlT extends string, infer AfterType extends string]
		? {
				name: StripIdentifierQuotes<ColName>;
				type: SqlTypeToTs<SqlT>;
				nullable: IsNullable<AfterType>;
			}
		: never
	: never;
type ColumnToRecord<C extends { name: string; type: unknown; nullable: boolean }> = {
	[K in C["name"]]: C["nullable"] extends true ? C["type"] | null : C["type"];
};
type Merge<A, B> = A & B;
type Simplify<T> = { [K in keyof T]: T[K] };
type AddColumn<Head extends string, Row, Names extends string> = ParseColumn<Head> extends infer C extends {
	name: string;
	type: unknown;
	nullable: boolean;
}
	? { row: Merge<Row, ColumnToRecord<C>>; names: Names | C["name"]; error: never }
	: { row: Row; names: Names; error: SqlParseError<`Invalid column definition: ${Trim<Head>}`> };

type StripConstraintPrefix<S extends string> = ToLower<Trim<S>> extends `constraint ${infer Rest}`
	? ReadIdentifier<Trim<Rest>> extends [string, infer AfterName extends string]
		? Trim<ToLower<AfterName>>
		: ToLower<Trim<S>>
	: ToLower<Trim<S>>;
type IsConstraintEntry<S extends string> = StripConstraintPrefix<S> extends
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

type ValidateConstraintRefs<Entry extends string, Names extends string> = StripConstraintPrefix<Entry> extends infer E extends string
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
type ParseForeignRefMeta<Entry extends string> = StripConstraintPrefix<Entry> extends infer E extends string
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

type MergeError<Current, Next> = Next extends true ? Current : Current | Next;
type ParseCreateBody<S extends string, Row, Names extends string, Error = never, Refs extends ForeignRefMeta = never> = Trim<S> extends ""
	? { row: Row; names: Names; error: Error; refs: Refs }
	: ReadUntilTopLevelComma<S> extends [infer Head extends string, infer Tail extends string]
		? IsConstraintEntry<Head> extends true
			? ParseCreateBody<
					Tail,
					Row,
					Names,
					MergeError<Error, ValidateConstraintRefs<Head, Names>>,
					Refs | ParseForeignRefMeta<Head>
			  >
			: AddColumn<Head, Row, Names> extends infer Next extends { row: unknown; names: string; error: unknown }
				? ParseCreateBody<Tail, Next["row"], Next["names"], MergeError<Error, Next["error"]>, Refs>
				: {
						row: Row;
						names: Names;
						error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>;
						refs: Refs;
				  }
		: {
				row: Row;
				names: Names;
				error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>;
				refs: Refs;
		  };

type NormalizeSql<S extends string> = RemoveTrailingSemicolon<StripSqlComments<S>>;
type ExtractCreateTableNameInternal<S extends string> = ToLower<NormalizeSql<S>> extends `create table ${infer Rest}`
	? ReadIdentifier<Rest> extends [infer RawName extends string, string]
		? StripIdentifierQuotes<RawName>
		: never
	: never;
type ExtractCreateBody<S extends string> = ToLower<NormalizeSql<S>> extends `create table ${string}(${infer Inner})` ? Inner : never;

export type SqlCreateTableName<S extends string> = [ExtractCreateTableNameInternal<S>] extends [never]
	? SqlParseError<"Expected a CREATE TABLE statement with a table name">
	: ExtractCreateTableNameInternal<S>;

export type SqlCreateTableToType<S extends string> = [ExtractCreateBody<S>] extends [never]
	? SqlParseError<"Expected a CREATE TABLE statement">
	: ParseCreateBody<ExtractCreateBody<S>, {}, never> extends infer Parsed extends { row: unknown; error: unknown }
		? [Parsed["error"]] extends [never]
			? Simplify<Parsed["row"]>
			: Parsed["error"]
		: SqlParseError<"Internal SQL parser error">;

type SqlCreateTableForeignRefs<S extends string> = [ExtractCreateBody<S>] extends [never]
	? never
	: ParseCreateBody<ExtractCreateBody<S>, {}, never> extends infer Parsed extends { refs: ForeignRefMeta }
		? Parsed["refs"]
		: never;

/** Valid name + body: full create-table object. */
type SqlCreateTableObject<S extends string> = {
	readonly kind: "create_table";
	readonly name: SqlCreateTableName<S>;
	// General rule: types are helpers and must not become a bottleneck.
	readonly row: SqlCreateTableToType<S> extends infer Row ? { [K in keyof Row]: Row[K] } : never;
	readonly source: S;
	readonly __refs: SqlCreateTableForeignRefs<S>;
};

/**
 * When the table name parses but the body fails, the type is `SqlParseError<…>` (not an object with `row: SqlParseError`).
 * If the name fails, this stays an object so both `name` and `row` errors remain visible.
 */
export type SqlCreateTable<S extends string> = SqlCreateTableName<S> extends SqlParseError<string>
	? SqlCreateTableObject<S>
	: SqlCreateTableToType<S> extends SqlParseError<infer E>
		? SqlParseError<E>
		: SqlCreateTableObject<S>;

export type SqlCreateTableLike = {
	readonly kind: "create_table";
	readonly name: string | SqlParseError<string>;
	readonly row: unknown;
	readonly source: string;
	readonly __refs: ForeignRefMeta;
};
