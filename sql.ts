export type PrimitiveSqlType =
	| "int"
	| "integer"
	| "smallint"
	| "bigint"
	| "float"
	| "double"
	| "real"
	| "decimal"
	| "numeric"
	| "text"
	| "varchar"
	| "char"
	| "boolean"
	| "bool"
	| "date"
	| "timestamp"
	| "json";

export type SqlParseError<Message extends string> = {
	readonly __sql_parse_error__: Message;
};

type Ws = " " | "\n" | "\t" | "\r";

type TrimLeft<S extends string> = S extends `${Ws}${infer R}` ? TrimLeft<R> : S;
type TrimRight<S extends string> = S extends `${infer R}${Ws}` ? TrimRight<R> : S;
type Trim<S extends string> = TrimLeft<TrimRight<S>>;

type RemoveTrailingSemicolon<S extends string> = Trim<S> extends `${infer X};`
	? Trim<X>
	: Trim<S>;

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

type ReadDoubleQuotedIdentifier<
	S extends string,
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends `"`
		? [`"${Acc}"`, Rest]
		: ReadDoubleQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`"${Acc}"`, ""];

type ReadBacktickQuotedIdentifier<
	S extends string,
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
	? C extends "`"
		? [`\`${Acc}\``, Rest]
		: ReadBacktickQuotedIdentifier<Rest, `${Acc}${C}`>
	: [`\`${Acc}\``, ""];

type ReadBracketQuotedIdentifier<
	S extends string,
	Acc extends string = "",
> = S extends `${infer C}${infer Rest}`
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

type NormalizeTypeToken<S extends string> = ToLower<Trim<S>> extends `${infer Base}(${string}`
	? Trim<Base>
	: ToLower<Trim<S>>;

type SqlTypeToTs<T extends string> = NormalizeTypeToken<T> extends
	| "int"
	| "integer"
	| "smallint"
	| "bigint"
	| "float"
	| "double"
	| "real"
	| "decimal"
	| "numeric"
	? number
	: NormalizeTypeToken<T> extends "boolean" | "bool"
		? boolean
		: NormalizeTypeToken<T> extends "json"
			? unknown
			: string;

type IsNullable<ColumnSpec extends string> =
	ToLower<ColumnSpec> extends `${string} not null${string}` ? false : true;

type ParseColumn<
	Col extends string,
> = ReadIdentifier<Trim<Col>> extends [infer ColName extends string, infer Rest extends string]
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

type AddColumn<
	Head extends string,
	Row,
	Names extends string,
> = ParseColumn<Head> extends infer C extends {
	name: string;
	type: unknown;
	nullable: boolean;
}
	? {
			row: Merge<Row, ColumnToRecord<C>>;
			names: Names | C["name"];
			error: never;
		}
	: {
			row: Row;
			names: Names;
			error: SqlParseError<`Invalid column definition: ${Trim<Head>}`>;
	  };

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

type ValidateColumnRefs<
	List extends string,
	Names extends string,
> = Trim<List> extends ""
	? true
	: ReadUntilTopLevelComma<List> extends [infer Head extends string, infer Tail extends string]
		? StripIdentifierQuotes<Trim<Head>> extends Names
			? ValidateColumnRefs<Tail, Names>
			: SqlParseError<
					`Unknown column "${StripIdentifierQuotes<Trim<Head>>}" referenced in table constraint`
			  >
		: SqlParseError<"Unable to parse column reference list in table constraint">;

type ValidateConstraintRefs<
	Entry extends string,
	Names extends string,
> = StripConstraintPrefix<Entry> extends infer E extends string
	? E extends `primary key${string}`
		? FirstParenGroup<E> extends infer G extends string
			? ValidateColumnRefs<G, Names>
			: SqlParseError<"PRIMARY KEY must include a column list">
		: E extends `unique${string}`
			? FirstParenGroup<E> extends infer G extends string
				? ValidateColumnRefs<G, Names>
				: SqlParseError<"UNIQUE must include a column list">
			: E extends `foreign key${string}`
				? FirstParenGroup<E> extends infer G extends string
					? ValidateColumnRefs<G, Names>
					: SqlParseError<"FOREIGN KEY must include a local column list">
				: true
	: true;

type MergeError<Current, Next> = Next extends true ? Current : Current | Next;

type ParseCreateBody<
	S extends string,
	Row,
	Names extends string,
	Error = never,
> = Trim<S> extends ""
	? { row: Row; names: Names; error: Error }
	: ReadUntilTopLevelComma<S> extends [infer Head extends string, infer Tail extends string]
		? IsConstraintEntry<Head> extends true
			? ParseCreateBody<
					Tail,
					Row,
					Names,
					MergeError<Error, ValidateConstraintRefs<Head, Names>>
			  >
			: AddColumn<Head, Row, Names> extends infer Next extends {
						row: unknown;
						names: string;
						error: unknown;
				  }
				? ParseCreateBody<
						Tail,
						Next["row"],
						Next["names"],
						MergeError<Error, Next["error"]>
				  >
				: {
						row: Row;
						names: Names;
						error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>;
				  }
		: {
				row: Row;
				names: Names;
				error: MergeError<Error, SqlParseError<"Unable to parse CREATE TABLE body">>;
		  };

type NormalizeSql<S extends string> = RemoveTrailingSemicolon<StripSqlComments<S>>;

type ExtractCreateBody<S extends string> = ToLower<NormalizeSql<S>> extends `create table ${string}(${infer Inner})`
	? Inner
	: never;

/**
 * Parses a constrained SQL CREATE TABLE string into a row type.
 *
 * Supported subset:
 * - CREATE TABLE <name> (col type [NOT NULL], ...)
 * - primitive SQL types + varchar/char/decimal with (...) suffix
 * - nullable columns unless explicitly NOT NULL
 *
 * Not supported:
 * - quoted identifiers, table constraints, defaults with commas, complex expressions
 */
export type SqlCreateTableToType<S extends string> = [ExtractCreateBody<S>] extends [never]
	? SqlParseError<"Expected a CREATE TABLE statement">
	: ParseCreateBody<ExtractCreateBody<S>, {}, never> extends infer Parsed extends {
				row: unknown;
				error: unknown;
		  }
		? [Parsed["error"]] extends [never]
			? Simplify<Parsed["row"]>
			: Parsed["error"]
		: SqlParseError<"Internal SQL parser error">;
