import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { LastOf } from "../core/type-utils.ts"
import type { Nullable, SqlTypeShape } from "../core/sql-type-shape.ts"
import type { SameComparisonClass } from "./resolve-expression.ts"

/** Keys of a union as a tuple (declaration order in practice; best effort, the type system gives no guarantee). */
export type UnionToStringTuple<U extends string, Acc extends readonly string[] = []> = [U] extends [never]
	? Acc
	: LastOf<U> extends infer L extends string
		? UnionToStringTuple<Exclude<U, L>, [L, ...Acc]>
		: Acc

/** Output column names of a SELECT result in position order (`order` when the parser recorded it). */
type OutputOrder<Res> = Res extends { order: infer O extends readonly string[] }
	? O
	: Res extends { returning: infer R }
		? UnionToStringTuple<keyof R & string>
		: []

/** Numeric widening order of one comparison class; a wider type has a longer tuple. */
type NumericRank = {
	smallint: [1]
	int2: [1]
	integer: [1, 1]
	int: [1, 1]
	int4: [1, 1]
	bigint: [1, 1, 1]
	int8: [1, 1, 1]
	numeric: [1, 1, 1, 1]
	decimal: [1, 1, 1, 1]
	real: [1, 1, 1, 1, 1]
	float4: [1, 1, 1, 1, 1]
	"double precision": [1, 1, 1, 1, 1, 1]
	float8: [1, 1, 1, 1, 1, 1]
}

type WiderType<L extends SqlTypeShape, R extends SqlTypeShape> =
	Lowercase<L["type"]> extends infer Lt
		? Lowercase<R["type"]> extends infer Rt
			? Lt extends keyof NumericRank
				? Rt extends keyof NumericRank
					? NumericRank[Rt] extends [...NumericRank[Lt], ...unknown[]]
						? R
						: L
					: L
				: L
			: L
		: L

/** The common type of two matching set-operation columns (CORE-8); nullable if either is. */
type CommonSqlType<L extends SqlTypeShape, R extends SqlTypeShape> = L["type"] extends "null"
	? R["type"] extends "null"
		? L
		: Nullable<R>
	: R["type"] extends "null"
		? Nullable<L>
		: WiderType<L, R> extends infer W extends SqlTypeShape
			? { type: W["type"]; arg: W["arg"]; nullable: L["nullable"] extends true ? true : R["nullable"] }
			: never

type MergeColumns<
	LNames extends readonly string[],
	RNames extends readonly string[],
	LRet extends Record<string, SqlTypeShape>,
	RRet extends Record<string, SqlTypeShape>,
	Op extends string,
	Acc extends Record<string, SqlTypeShape> = {},
> = LNames extends readonly [infer Ln extends string, ...infer LRest extends readonly string[]]
	? RNames extends readonly [infer Rn extends string, ...infer RRest extends readonly string[]]
		? SameComparisonClass<LRet[Ln], RRet[Rn]> extends true
			? MergeColumns<LRest, RRest, LRet, RRet, Op, Acc & Record<Ln, CommonSqlType<LRet[Ln], RRet[Rn]>>>
			: FormatError<Errors["SET_OPERATION_INCOMPATIBLE_TYPES"], [Op, Ln]>
		: never
	: { [K in keyof Acc]: Acc[K] }

/**
 * CORE-8: result of `Left <Op> Right`: names from the left, common types, nullable when either side is.
 * `Op` is the keyword text for error messages (`UNION`, `INTERSECT`, `EXCEPT`).
 */
export type MergeSetOperation<
	Left extends { returning: Record<string, SqlTypeShape> },
	Right extends { returning: Record<string, SqlTypeShape> },
	Op extends string,
> =
	OutputOrder<Left> extends infer LNames extends readonly string[]
		? OutputOrder<Right> extends infer RNames extends readonly string[]
			? LNames["length"] extends RNames["length"]
				? MergeColumns<LNames, RNames, Left["returning"], Right["returning"], Op> extends infer M
					? M extends DbtyperErrorShape
						? M
						: M extends Record<string, SqlTypeShape>
							? { kind: "select"; returning: M; order: LNames }
							: never
					: never
				: FormatError<Errors["SET_OPERATION_COLUMN_COUNT_MISMATCH"], [Op]>
			: never
		: never

/** CORE-11: the first output name that occurs twice, or `never`. */
export type FirstDuplicateName<Names extends readonly string[], Seen extends string = never> = Names extends readonly [
	infer H extends string,
	...infer R extends readonly string[],
]
	? H extends Seen
		? H
		: FirstDuplicateName<R, Seen | H>
	: never

/** CORE-12: `WITH name (a, b) AS (…)` renames the query's output columns by position. */
export type RenameOutputColumns<
	Res extends { returning: Record<string, SqlTypeShape> },
	Names extends readonly string[],
	CteName extends string = "",
> =
	OutputOrder<Res> extends infer Old extends readonly string[]
		? Old["length"] extends Names["length"]
			? { kind: "select"; returning: RenameByPosition<Old, Names, Res["returning"]>; order: Names }
			: FormatError<Errors["CTE_COLUMN_LIST_MISMATCH"], [CteName]>
		: never

type RenameByPosition<
	Old extends readonly string[],
	Names extends readonly string[],
	Ret extends Record<string, SqlTypeShape>,
	Acc extends Record<string, SqlTypeShape> = {},
> = Old extends readonly [infer O extends string, ...infer ORest extends readonly string[]]
	? Names extends readonly [infer N extends string, ...infer NRest extends readonly string[]]
		? RenameByPosition<ORest, NRest, Ret, Acc & Record<N, Ret[O]>>
		: never
	: { [K in keyof Acc]: Acc[K] }
