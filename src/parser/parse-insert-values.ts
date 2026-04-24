import type { ParseColumnList } from "./sql-constraints-fk.ts"
import type { SkippedStatement, SkipStatement } from "./skip-statement.ts"
import type {
	ReadExpectedToken,
	ReadQualifiedIdentifierFromBuffer,
	SqlQualifiedIdentifier,
} from "./sql-primitives.ts"
import type { PeekToken, SkipToken, TokensList, SqlParserError } from "../../core/sql-tokens.ts"

export type InsertValuesStatement = {
	kind: "insert_values"
	target: SqlQualifiedIdentifier
	columns: string[]
	valueTypes: unknown[]
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
			? ParseValueList<Rest3> extends [infer Rest4 extends TokensList, infer ParsedValues]
				? ParsedValues extends SqlParserError<string>
					? [Rest4, ParsedValues]
					: ParsedValues extends unknown[]
						? TupleLenEq<Cols, ParsedValues> extends true
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
	PeekToken<Tokens> extends ")"
		? [SkipToken<Tokens>, Acc]
		: ParseOneValue<Tokens> extends [infer After extends TokensList, infer V]
			? V extends SqlParserError<string>
				? [After, V]
				: PeekToken<After> extends ","
					? ParseValueListTail<SkipToken<After>, [...Acc, V]>
					: PeekToken<After> extends ")"
						? [SkipToken<After>, [...Acc, V]]
						: [After, SqlParserError<"Expected ) or comma after INSERT value">]
			: never

type ParseOneValue<Tokens extends TokensList> =
	PeekToken<Tokens> extends infer T extends string
		? T extends "null"
			? [SkipToken<Tokens>, null]
			: T extends "true"
				? [SkipToken<Tokens>, true]
				: T extends "false"
					? [SkipToken<Tokens>, false]
					: T extends `"${string}"`
						? [SkipToken<Tokens>, string]
						: T extends `'${string}'`
							? [SkipToken<Tokens>, string]
							: T extends `${number}`
								? [SkipToken<Tokens>, number]
								: [Tokens, SqlParserError<"Unsupported value in INSERT">]
		: [Tokens, SqlParserError<"Unsupported value in INSERT">]
