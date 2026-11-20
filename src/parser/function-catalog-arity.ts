import type { Errors, FormatErrorOf } from "../dbtyper-error.ts"

/**
 * Argument-count rules that are compile errors (FN-5, FN-7…FN-10, FN-12, FN-19…FN-21, FN-24):
 * `[min, max, error key]`, `-1` = no limit; a fourth element `"name"`: the message names the function (SQLT-72).
 * Supported: min 0, 1 or 2, with no limit or a `max` ≥ `min`.
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
	jsonTable: [1, 2, "JSON_TABLE_FUNCTION_TAKES_1_OR_2_ARGUMENTS", "name"]
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

/** The counts 0 … `N`. */
type CountsUpTo<N extends number, Acc extends readonly unknown[] = []> = Acc["length"] extends N
	? N
	: Acc["length"] | CountsUpTo<N, [...Acc, unknown]>

type ArgsFit<Args extends readonly unknown[], Min extends number, Max extends number> =
	EnoughArgs<Args, Min> extends true
		? Max extends -1
			? true
			: Args["length"] extends CountsUpTo<Max>
				? true
				: false
		: false

/** The arity error of a row for `Args` (of function `Name`); `null` when the argument count is fine. */
export type CatalogArityError<Row, Args extends readonly unknown[], Name extends string> = Row extends readonly [
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
			...infer Named,
		]
		? ArgsFit<Args, Min, Max> extends true
			? null
			: FormatErrorOf<Errors[Key], Named extends readonly ["name"] ? [Name] : []>
		: null
	: null
