import type { ParseColumnList } from "./sql-constraints-fk.ts"
import type { SkippedStatement, SkipStatement } from "./skip-statement.ts"
import type { ReadExpectedToken, ReadQualifiedIdentifierFromBuffer, SqlQualifiedIdentifier } from "./sql-primitives.ts"
import type { PeekToken, SkipToken, TokensList, SqlParserError, TokenType } from "../../core/sql-tokens.ts"

export type InsertValuesStatement = {
	kind: "insert_values"
	target: SqlQualifiedIdentifier
	columns: string[]
	valueTypes: unknown[][]
}

export type ParseInsertValues<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "into", "Expected INTO after INSERT"> extends [
		infer Rest0 extends TokensList,
		infer OkInto,
	]
		? OkInto extends true
			? ParseInsertAfterInto<Rest0>
			: [Rest0, Extract<OkInto, SqlParserError<string>>]
		: never

type ParseInsertAfterValuesKeyword<
	Tokens extends TokensList,
	Table extends SqlQualifiedIdentifier,
	Cols extends string[],
> =
	ReadExpectedToken<Tokens, "values", "Expected VALUES after column list"> extends [
		infer Rest3 extends TokensList,
		infer OkVals,
	]
		? OkVals extends true
			? ParseValuesRows<Rest3> extends [infer Rest4 extends TokensList, infer ParsedValues]
				? ParsedValues extends SqlParserError<string>
					? [Rest4, ParsedValues]
					: ParsedValues extends unknown[][]
						? ValidateRowsLen<Cols, ParsedValues> extends true
							? SkipStatement<Rest4> extends [infer RestFinal extends TokensList, infer SkipResult]
								? SkipResult extends SkippedStatement
									? [
											RestFinal,
											{
												kind: "insert_values"
												target: Table
												columns: Cols
												valueTypes: ParsedValues
											},
										]
									: [RestFinal, SqlParserError<"Unable to parse INSERT">]
								: never
							: [Rest4, SqlParserError<"INSERT column count does not match value count">]
						: [Rest4, SqlParserError<"Unable to parse INSERT values">]
				: never
			: [Rest3, Extract<OkVals, SqlParserError<string>>]
		: never

type ParseInsertAfterInto<Tokens extends TokensList> =
	ReadQualifiedIdentifierFromBuffer<Tokens> extends [
		infer Rest1 extends TokensList,
		infer TableResult extends SqlQualifiedIdentifier | SqlParserError<string>,
	]
		? TableResult extends SqlParserError<string>
			? [Rest1, SqlParserError<"Expected table name in INSERT">]
			: ParseColumnList<Rest1> extends [infer Rest2 extends TokensList, infer Cols]
				? Cols extends string[]
					? ParseInsertAfterValuesKeyword<Rest2, Extract<TableResult, SqlQualifiedIdentifier>, Cols>
					: [Rest2, SqlParserError<"Unable to parse INSERT column list">]
				: never
		: never

type TupleLenEq<A extends unknown[], B extends unknown[]> = A["length"] extends B["length"]
	? B["length"] extends A["length"]
		? true
		: false
	: false

type ValidateRowsLen<Cols extends string[], Rows extends unknown[][]> = Rows extends [
	infer First extends unknown[],
	...infer Rest extends unknown[][],
]
	? TupleLenEq<Cols, First> extends true
		? ValidateRowsLen<Cols, Rest>
		: false
	: true

type ParseValuesRows<Tokens extends TokensList> =
	ParseValueList<Tokens> extends [infer Rest extends TokensList, infer Row]
		? Row extends SqlParserError<string>
			? [Rest, Row]
			: Row extends unknown[]
				? ParseValuesRowsTail<Rest, [Row]>
				: [Rest, SqlParserError<"Unable to parse INSERT values">]
		: never

type ParseValuesRowsTail<Tokens extends TokensList, Acc extends unknown[][]> =
	PeekToken<Tokens> extends TokenType<"key", ","> ? ParseValuesRowsAfterComma<SkipToken<Tokens>, Acc> : [Tokens, Acc]

type ParseValuesRowsAfterComma<Tokens extends TokensList, Acc extends unknown[][]> =
	PeekToken<Tokens> extends TokenType<"key", "(">
		? ParseValueList<Tokens> extends [infer Rest extends TokensList, infer Row]
			? Row extends SqlParserError<string>
				? [Rest, Row]
				: Row extends unknown[]
					? ParseValuesRowsTail<Rest, [...Acc, Row]>
					: [Rest, SqlParserError<"Unable to parse INSERT values">]
			: never
		: [Tokens, SqlParserError<"Expected ( before next INSERT values row">]

type ParseValueList<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "(", "Expected ( before INSERT values"> extends [
		infer Rest extends TokensList,
		infer OpenOk,
	]
		? OpenOk extends true
			? ParseValueListTail<Rest>
			: [Rest, Extract<OpenOk, SqlParserError<string>>]
		: never

type ParseValueListTail<Tokens extends TokensList, Acc extends unknown[] = []> =
	PeekToken<Tokens> extends TokenType<"key", ")">
		? [SkipToken<Tokens>, Acc]
		: ParseOneValue<Tokens> extends [infer After extends TokensList, infer V]
			? V extends SqlParserError<string>
				? [After, V]
				: PeekToken<After> extends TokenType<"key", ",">
					? ParseValueListTail<SkipToken<After>, [...Acc, V]>
					: PeekToken<After> extends TokenType<"key", ")">
						? [SkipToken<After>, [...Acc, V]]
						: [After, SqlParserError<"Expected ) or comma after INSERT value">]
			: never

type ParseOneValue<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", "null">
		? [SkipToken<Tokens>, null]
		: PeekToken<Tokens> extends TokenType<"key", "true">
			? [SkipToken<Tokens>, true]
			: PeekToken<Tokens> extends TokenType<"key", "false">
				? [SkipToken<Tokens>, false]
				: PeekToken<Tokens> extends TokenType<"key", "(">
					? ParseParenthesizedValue<SkipToken<Tokens>>
					: PeekToken<Tokens> extends TokenType<"key", "default">
						? [SkipToken<Tokens>, unknown]
						: PeekToken<Tokens> extends TokenType<
									"key",
									"current_timestamp" | "current_date" | "current_time"
							  >
							? [SkipToken<Tokens>, unknown]
							: PeekToken<Tokens> extends TokenType<"key", "now">
								? ParseNowFunctionValue<SkipToken<Tokens>>
								: PeekToken<Tokens> extends TokenType<"key", "+" | "-">
									? ParseSignedNumberValue<SkipToken<Tokens>>
									: PeekToken<Tokens> extends TokenType<"key", `${number}`>
										? ParseNumberishTail<Tokens>
										: PeekToken<Tokens> extends TokenType<"string", string>
											? [SkipToken<Tokens>, string]
											: [Tokens, SqlParserError<"Unsupported value in INSERT">]

type ParseParenthesizedValue<Tokens extends TokensList> =
	ParseOneValue<Tokens> extends [infer Rest extends TokensList, infer V]
		? V extends SqlParserError<string>
			? [Rest, V]
			: ReadExpectedToken<Rest, ")", "Expected ) after parenthesized INSERT value"> extends [
						infer RestClose extends TokensList,
						infer OkClose,
				  ]
				? OkClose extends true
					? [RestClose, V]
					: [RestClose, Extract<OkClose, SqlParserError<string>>]
				: never
		: never

type ParseNowFunctionValue<Tokens extends TokensList> =
	ReadExpectedToken<Tokens, "(", "Expected ( after NOW"> extends [infer RestOpen extends TokensList, infer OpenOk]
		? OpenOk extends true
			? ReadExpectedToken<RestOpen, ")", "Expected ) after NOW("> extends [
					infer RestClose extends TokensList,
					infer CloseOk,
				]
				? CloseOk extends true
					? [RestClose, unknown]
					: [RestClose, Extract<CloseOk, SqlParserError<string>>]
				: never
			: [RestOpen, Extract<OpenOk, SqlParserError<string>>]
		: never

type ParseSignedNumberValue<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", `${number}`>
		? ParseNumberishTail<Tokens>
		: [Tokens, SqlParserError<"Expected number after sign in INSERT value">]

type ParseNumberishTail<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", `${number}`>
		? ParseNumberishAfterInt<SkipToken<Tokens>>
		: [Tokens, number]

type ParseNumberishAfterInt<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", "."> ? ParseNumberishDecimalTail<SkipToken<Tokens>> : [Tokens, number]

type ParseNumberishDecimalTail<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenType<"key", `${number}`>
		? [SkipToken<Tokens>, number]
		: [Tokens, SqlParserError<"Expected decimal part in INSERT numeric value">]
