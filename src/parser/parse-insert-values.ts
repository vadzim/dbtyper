import type { ParseColumnListToTuple } from "./sql-constraints-fk.js"
import type { SkippedStatement, SkipStatement } from "./skip-statement.js"
import type {
	IsBufferEnd,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.js"
import type { PeekToken, SkipToken, TokensList, EmptyTokenList, SqlParserError } from "./sql-tokens.js"

export type InsertValuesStatement = {
	readonly kind: "insert_values"
	readonly target: SqlQualifiedIdentifier
	readonly columns: readonly string[]
	readonly valueTypes: readonly unknown[]
}

/** `Tokens` must point at `insert` (caller routes on first keyword). */
export type ParseInsertValues<Tokens extends TokensList> = FinalizeInsert<ParseInsertTuple<Tokens>>

type FinalizeInsert<T> = T extends [infer E extends SqlParserError<string>, infer R extends TokensList]
	? [E, R]
	: T extends [
				{
					readonly target: infer Q extends SqlQualifiedIdentifier
					readonly columns: infer Cols extends readonly string[]
					readonly valueTypes: infer Vals extends readonly unknown[]
				},
				infer Rest extends TokensList,
		  ]
		? [
				{
					readonly kind: "insert_values"
					readonly target: Q
					readonly columns: Cols
					readonly valueTypes: Vals
				},
				Rest,
			]
		: [SqlParserError<"Unable to parse INSERT">, EmptyTokenList]

type ParseInsertAfterValuesKeyword<
	Table extends SqlQualifiedIdentifier,
	Cols extends readonly string[],
	Rest2 extends TokensList,
> = ReadExpectedToken<Rest2, "values", "Expected VALUES after column list"> extends [
	infer OkVals,
	infer Rest3 extends TokensList,
]
	? OkVals extends true
		? ReadFirstParenGroup<Rest3> extends [infer ValInner extends TokensList, infer Rest4 extends TokensList]
			? ParseValueListToTuple<ValInner> extends [infer ParsedValues, infer ParsedRest extends TokensList]
				? ParsedValues extends SqlParserError<string>
					? [ParsedValues, ParsedRest]
					: ParsedValues extends readonly unknown[]
						? TupleLenEq<Cols, ParsedValues> extends true
							? SkipStatement<Rest4> extends [SkippedStatement, infer RestFinal extends TokensList]
								? [
										{
											readonly target: Table
											readonly columns: Cols
											readonly valueTypes: ParsedValues
										},
										RestFinal,
									]
								: [SqlParserError<"Unable to parse INSERT">, EmptyTokenList]
							: [SqlParserError<"INSERT column count does not match value count">, EmptyTokenList]
						: [SqlParserError<"Unable to parse INSERT values">, EmptyTokenList]
				: never
			: [SqlParserError<"Expected value tuple in INSERT">, EmptyTokenList]
		: OkVals extends SqlParserError<string>
			? [OkVals, Rest3]
			: [SqlParserError<"Unable to parse INSERT">, EmptyTokenList]
	: never

type ParseInsertAfterInto<Rest0 extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<Rest0> extends [
		infer Table extends SqlQualifiedIdentifier,
		infer Rest1 extends TokensList,
	]
		? ReadFirstParenGroup<Rest1> extends [infer ColInner extends TokensList, infer Rest2 extends TokensList]
			? ParseColumnListToTuple<ColInner> extends [infer Cols extends readonly string[], infer _]
				? ParseInsertAfterValuesKeyword<Table, Cols, Rest2>
				: [SqlParserError<"Unable to parse INSERT column list">, EmptyTokenList]
			: [SqlParserError<"Expected column list in INSERT">, EmptyTokenList]
		: [SqlParserError<"Expected table name in INSERT">, EmptyTokenList]

type ParseInsertTuple<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "into", "Expected INTO after INSERT"> extends [
		infer OkInto,
		infer Rest0 extends TokensList,
	]
		? OkInto extends true
			? ParseInsertAfterInto<Rest0>
			: OkInto extends SqlParserError<string>
				? [OkInto, Rest0]
				: [SqlParserError<"Unable to parse INSERT">, EmptyTokenList]
		: never

type TupleLenEq<A extends readonly unknown[], B extends readonly unknown[]> = A["length"] extends B["length"]
	? B["length"] extends A["length"]
		? true
		: false
	: false

type ParseValueListToTuple<Tokens extends TokensList> =
	PeekToken<Tokens> extends ""
		? [SqlParserError<"Unclosed value list in INSERT">, EmptyTokenList]
		: PeekToken<Tokens> extends ")"
			? [readonly [], Tokens]
			: ParseOneValue<Tokens> extends [infer V, infer After extends TokensList]
				? PeekToken<After> extends ","
					? SkipToken<After> extends infer AfterComma extends TokensList
						? ParseValueListToTuple<AfterComma> extends [
								infer Rest extends readonly unknown[],
								infer Tail extends TokensList,
							]
							? [readonly [V, ...Rest], Tail]
							: [SqlParserError<"Unable to parse INSERT values">, EmptyTokenList]
						: never
					: PeekToken<After> extends ")"
						? [readonly [V], After]
						: IsBufferEnd<After> extends true
							? [readonly [V], After]
							: [SqlParserError<"Expected ) or comma after INSERT value">, After]
				: [SqlParserError<"Unable to parse INSERT value">, EmptyTokenList]

type ParseOneValue<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer T extends string
		? T extends "null"
			? [null, SkipToken<Tokens>]
			: T extends "true"
				? [true, SkipToken<Tokens>]
				: T extends "false"
					? [false, SkipToken<Tokens>]
					: T extends `"${string}"`
						? [string, SkipToken<Tokens>]
						: T extends `'${string}'`
							? [string, SkipToken<Tokens>]
							: T extends `${number}`
								? [number, SkipToken<Tokens>]
								: [SqlParserError<"Unsupported value in INSERT">, EmptyTokenList]
		: [SqlParserError<"Unsupported value in INSERT">, EmptyTokenList]
