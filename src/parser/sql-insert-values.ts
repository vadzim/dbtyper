import type { ParseColumnListToTuple } from "./sql-constraints-fk.js"
import type {
	ReadBufferEnd,
	ReadExpectedToken,
	ReadFirstParenGroup,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-parse-primitives.js"
import type { SkipTailToSemicolonBuffer } from "./sql-skip-statement.js"
import type { PeekToken, SkipToken, TokensList, EmptyTokenList, SqlParseError } from "./sql-tokens.js"

export type SqlInsertValues = {
	readonly kind: "insert_values_validated"
	readonly target: SqlQualifiedIdentifier
	readonly columns: readonly string[]
	readonly valueTypes: readonly unknown[]
}

/** `B` must point at `insert` (caller routes on first keyword). */
export type ParseInsertValues<B extends TokensList> = FinalizeInsert<ParseInsertTuple<B>>

type FinalizeInsert<T> = T extends [infer E extends SqlParseError<string>, infer R extends TokensList]
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
					readonly kind: "insert_values_validated"
					readonly target: Q
					readonly columns: Cols
					readonly valueTypes: Vals
				},
				Rest,
			]
		: [SqlParseError<"Unable to parse INSERT">, EmptyTokenList]

type ParseInsertTuple<B extends TokensList> =
	ReadExpectedToken<B, "into", "Expected INTO after INSERT"> extends [true, infer Rest0 extends TokensList]
		? ReadQualifiedIdentifierFromBuffer<Rest0> extends [
				infer Table extends SqlQualifiedIdentifier,
				infer Rest1 extends TokensList,
			]
			? ReadFirstParenGroup<Rest1> extends [infer ColInner extends TokensList, infer Rest2 extends TokensList]
				? ParseColumnListToTuple<ColInner> extends [infer Cols extends readonly string[], infer _]
					? ReadExpectedToken<Rest2, "values", "Expected VALUES after column list"> extends [
							true,
							infer Rest3 extends TokensList,
						]
						? ReadFirstParenGroup<Rest3> extends [
								infer ValInner extends TokensList,
								infer Rest4 extends TokensList,
							]
							? ParseValueListToTuple<ValInner> extends [
									infer Vals extends readonly unknown[],
									infer _VRest,
								]
								? TupleLenEq<Cols, Vals> extends true
									? SkipTailToSemicolonBuffer<Rest4> extends [
											true,
											infer RestFinal extends TokensList,
										]
										? [
												{
													readonly target: Table
													readonly columns: Cols
													readonly valueTypes: Vals
												},
												RestFinal,
											]
										: SkipTailToSemicolonBuffer<Rest4> extends [
													infer Err extends SqlParseError<string>,
													infer _R,
											  ]
											? [Err, Rest4]
											: [SqlParseError<"Unable to parse INSERT">, Rest4]
									: [SqlParseError<"INSERT column count does not match value count">, Rest3]
								: ParseValueListToTuple<ValInner> extends [
											infer Err extends SqlParseError<string>,
											infer R,
									  ]
									? [Err, R]
									: [SqlParseError<"Unable to parse INSERT values">, Rest3]
							: [SqlParseError<"Expected value tuple in INSERT">, Rest3]
						: ReadExpectedToken<Rest2, "values", "Expected VALUES after column list"> extends [
									infer E extends SqlParseError<string>,
									infer R extends TokensList,
							  ]
							? [E, R]
							: [SqlParseError<"Unable to parse INSERT">, Rest2]
					: [SqlParseError<"Unable to parse INSERT column list">, Rest1]
				: [SqlParseError<"Expected column list in INSERT">, Rest0]
			: [SqlParseError<"Expected table name in INSERT">, Rest0]
		: ReadExpectedToken<B, "into", "Expected INTO after INSERT"> extends [
					infer E extends SqlParseError<string>,
					infer R extends TokensList,
			  ]
			? [E, R]
			: [SqlParseError<"Unable to parse INSERT">, B]

type TupleLenEq<A extends readonly unknown[], B extends readonly unknown[]> = A["length"] extends B["length"]
	? B["length"] extends A["length"]
		? true
		: false
	: false

type ParseValueListToTuple<B extends TokensList> =
	PeekToken<B> extends ""
		? [SqlParseError<"Unclosed value list in INSERT">, B]
		: PeekToken<B> extends ")"
			? [readonly [], B]
			: ParseOneValue<B> extends [infer V, infer After extends TokensList]
				? PeekToken<After> extends ","
					? ParseValueListToTuple<SkipToken<After>> extends [
							infer Rest extends readonly unknown[],
							infer Tail extends TokensList,
						]
						? [readonly [V, ...Rest], Tail]
						: [SqlParseError<"Unable to parse INSERT values">, After]
					: PeekToken<After> extends ")"
						? [readonly [V], After]
						: ReadBufferEnd<After> extends [true, infer _]
							? [readonly [V], After]
							: [SqlParseError<"Expected ) or comma after INSERT value">, After]
				: [SqlParseError<"Unable to parse INSERT value">, B]

type ParseOneValue<B extends TokensList> =
	PeekToken<B> extends infer T extends string
		? T extends "null"
			? [null, SkipToken<B>]
			: T extends "true"
				? [true, SkipToken<B>]
				: T extends "false"
					? [false, SkipToken<B>]
					: T extends `"${string}"`
						? [string, SkipToken<B>]
						: T extends `'${string}'`
							? [string, SkipToken<B>]
							: T extends `${number}`
								? [number, SkipToken<B>]
								: [SqlParseError<"Unsupported value in INSERT">, B]
		: [SqlParseError<"Unsupported value in INSERT">, B]
