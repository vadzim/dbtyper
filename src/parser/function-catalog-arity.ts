import type { Errors, FormatErrorOf } from "../dbtyper-error.ts"

/**
 * Argument-count rules that are compile errors (FN-5, FN-7…FN-10, FN-12, FN-19…FN-21, FN-24):
 * `[min, max, error key]`, `-1` = no limit. Supported: min 0, 1 or 2 with no limit, or `min` = `max`.
 */
type ArityRules = {
	atLeastOne: [1, -1, "FUNCTION_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	coalesce: [1, -1, "COALESCE_REQUIRES_AT_LEAST_ONE_ARGUMENT"]
	sum: [1, -1, "SUM_REQUIRES_AN_ARGUMENT"]
	now: [0, 0, "NOW_TAKES_NO_ARGUMENTS"]
	noArgs: [0, 0, "THIS_FUNCTION_TAKES_NO_ARGUMENTS"]
	rowNumber: [0, 0, "ROW_NUMBER_TAKES_NO_ARGUMENTS"]
	rankDenseRank: [0, 0, "RANK_DENSE_RANK_TAKES_NO_ARGUMENTS"]
	lagLead: [1, -1, "LAG_LEAD_REQUIRES_AT_LEAST_1_ARGUMENT"]
	arrayLength: [2, 2, "ARRAY_LENGTH_REQUIRES_2_ARGUMENTS"]
	arrayAppend: [2, 2, "ARRAY_APPEND_REQUIRES_2_ARGUMENTS"]
	arrayPrepend: [2, 2, "ARRAY_PREPEND_REQUIRES_2_ARGUMENTS"]
	unnest: [1, 1, "UNNEST_REQUIRES_1_ARGUMENT"]
}

type EnoughArgs<Args extends readonly unknown[], Min extends number> = Min extends 0
	? true
	: Min extends 1
		? Args extends readonly [unknown, ...unknown[]]
			? true
			: false
		: Args extends readonly [unknown, unknown, ...unknown[]]
			? true
			: false

type ArgsFit<Args extends readonly unknown[], Min extends number, Max extends number> = Max extends -1
	? EnoughArgs<Args, Min>
	: Args["length"] extends Max
		? true
		: false

/** The arity error of a row for `Args`; `null` when the argument count is fine. */
export type CatalogArityError<Row, Args extends readonly unknown[]> = Row extends readonly [
	string,
	string,
	string,
	infer Rule extends keyof ArityRules,
	...unknown[],
]
	? ArityRules[Rule] extends readonly [
			infer Min extends number,
			infer Max extends number,
			infer Key extends keyof Errors,
		]
		? ArgsFit<Args, Min, Max> extends true
			? null
			: FormatErrorOf<Errors[Key], []>
		: null
	: null
