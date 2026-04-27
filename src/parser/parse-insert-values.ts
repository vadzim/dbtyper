import type { ParseColumnList } from "./sql-constraints-fk.ts"
import type { SkippedStatement, SkipStatement } from "./skip-statement.ts"
import type { ReadExpectedToken, ReadQualifiedIdentifierFromBuffer, SqlQualifiedIdentifier } from "./sql-primitives.ts"
import type { SqlQueryParameterDescription } from "./parse-select.ts"
import type {
	PeekToken,
	SkipToken,
	TokensList,
	SqlParserError,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenString,
} from "../../core/sql-tokens.ts"

export type InsertStatementValueCell =
	| null
	| true
	| false
	| string
	| number
	| unknown
	| { kind: "param"; name: string }

export type InsertValuesStatement = {
	kind: "insert_values"
	target: SqlQualifiedIdentifier
	columns: string[]
	valueTypes: InsertStatementValueCell[][]
	queryParams: Record<string, SqlQueryParameterDescription>
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
					: ParsedValues extends InsertStatementValueCell[][]
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
												queryParams: InsertParamsFromRows<Cols, ParsedValues>
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

type InsertParamsFromRows<
	Cols extends string[],
	Rows extends InsertStatementValueCell[][],
> = Rows extends readonly [
	infer Row extends InsertStatementValueCell[],
	...infer Rest extends InsertStatementValueCell[][],
]
	? InsertParamsFromRow<Cols, Row> & InsertParamsFromRows<Cols, Rest>
	: {}

type InsertParamsFromRow<
	Cols extends string[],
	Vals extends InsertStatementValueCell[],
> = Cols extends [infer C extends string, ...infer CR extends string[]]
	? Vals extends [infer V extends InsertStatementValueCell, ...infer VR extends InsertStatementValueCell[]]
		? V extends { kind: "param"; name: infer N extends string }
			? { [K in N]: { kind: "insert_value"; column: C } } & InsertParamsFromRow<CR, VR>
			: InsertParamsFromRow<CR, VR>
		: {}
	: {}

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
			: Row extends InsertStatementValueCell[]
				? ParseValuesRowsTail<Rest, [Row]>
				: [Rest, SqlParserError<"Unable to parse INSERT values">]
		: never

type ParseValuesRowsTail<Tokens extends TokensList, Acc extends InsertStatementValueCell[][]> =
	PeekToken<Tokens> extends TokenKey<","> ? ParseValuesRowsAfterComma<SkipToken<Tokens>, Acc> : [Tokens, Acc]

type ParseValuesRowsAfterComma<Tokens extends TokensList, Acc extends unknown[][]> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseValueList<Tokens> extends [infer Rest extends TokensList, infer Row]
			? Row extends SqlParserError<string>
				? [Rest, Row]
				: Row extends InsertStatementValueCell[]
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

type ParseValueListTail<Tokens extends TokensList, Acc extends InsertStatementValueCell[] = []> =
	PeekToken<Tokens> extends TokenKey<")">
		? [SkipToken<Tokens>, Acc]
		: ParseOneValue<Tokens> extends [infer After extends TokensList, infer V]
			? V extends SqlParserError<string>
				? [After, V]
				: PeekToken<After> extends TokenKey<",">
					? ParseValueListTail<SkipToken<After>, [...Acc, V]>
					: PeekToken<After> extends TokenKey<")">
						? [SkipToken<After>, [...Acc, V]]
						: [After, SqlParserError<"Expected ) or comma after INSERT value">]
			: never

type ParseOneValue<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenKey<"null">
		? [SkipToken<Tokens>, null]
		: PeekToken<Tokens> extends TokenKey<"true">
			? [SkipToken<Tokens>, true]
			: PeekToken<Tokens> extends TokenKey<"false">
				? [SkipToken<Tokens>, false]
				: PeekToken<Tokens> extends TokenKey<":">
					? [SkipToken<Tokens>] extends [infer AfterColon extends TokensList]
						? PeekToken<AfterColon> extends TokenIdent<infer N extends string>
							? [SkipToken<AfterColon>, { kind: "param"; name: N }]
							: [AfterColon, SqlParserError<"Expected identifier after :">]
						: never
					: PeekToken<Tokens> extends TokenKey<"(">
					? ParseParenthesizedValue<SkipToken<Tokens>>
					: PeekToken<Tokens> extends TokenKey<"default">
						? [SkipToken<Tokens>, unknown]
						: PeekToken<Tokens> extends TokenKey<"current_timestamp" | "current_date" | "current_time">
							? [SkipToken<Tokens>, unknown]
							: PeekToken<Tokens> extends TokenKey<"now">
								? ParseNowFunctionValue<SkipToken<Tokens>>
								: PeekToken<Tokens> extends TokenKey<"+" | "-">
									? ParseSignedNumberValue<SkipToken<Tokens>>
									: PeekToken<Tokens> extends TokenNumber<string>
										? ParseNumberishTail<Tokens>
										: PeekToken<Tokens> extends TokenString<string>
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
	PeekToken<Tokens> extends TokenNumber<string>
		? ParseNumberishTail<Tokens>
		: [Tokens, SqlParserError<"Expected number after sign in INSERT value">]

type ParseNumberishTail<Tokens extends TokensList> =
	PeekToken<Tokens> extends TokenNumber<string>
		? [SkipToken<Tokens>, number]
		: [Tokens, SqlParserError<"Expected numeric literal">]
