import type { MergeRecords } from "../core/type-utils.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ColumnDef, NotNullType, PkKind } from "./parse-create-table.ts"

type ColPair = { cols: Record<string, SqlTypeShape>; facts: Record<string, unknown> }

export type OneCol<C extends ColumnDef> = C extends readonly [
	infer N extends string,
	infer Sql extends SqlTypeShape,
	infer NotNull extends boolean,
	infer HasDefault extends boolean,
	infer Generated extends boolean | "identity",
	infer _Pk extends PkKind,
	infer _Decl extends string,
]
	? {
			cols: Record<N, NotNull extends true ? (Sql["nullable"] extends false ? Sql : NotNullType<Sql>) : Sql>
			facts: Generated extends "identity"
				? Record<N, { nullability: "not_null"; generated: true; identity: true }>
				: Generated extends true
					? NotNull extends true
						? Record<N, { nullability: "not_null"; generated: true }>
						: Record<N, { generated: true }>
					: NotNull extends true
						? HasDefault extends true
							? Record<N, { nullability: "not_null"; default: true }>
							: Record<N, { nullability: "not_null" }>
						: HasDefault extends true
							? Record<N, { default: true }>
							: {}
		}
	: never

type MergeColPair<A extends ColPair, B extends ColPair> = {
	cols: MergeRecords<A["cols"], B["cols"]>
	facts: MergeRecords<A["facts"], B["facts"]>
}

/**
 * Batched merge (chunks of 4) to keep conditional-type depth bounded on wide tables. Found by trial: merging one
 * column at a time made the recursion too deep ("Type instantiation is excessively deep") at about 100 columns;
 * the 4 comes from the unrolled shapes below, a bigger chunk only repeats more code (#105, #48).
 */
export type ColumnsFromStack<S extends readonly ColumnDef[]> = S extends { 79: ColumnDef }
	? WideColumnsFromStack<S>
	: S extends readonly []
		? { cols: {}; facts: {} }
		: S extends readonly [infer C0 extends ColumnDef]
			? OneCol<C0>
			: S extends readonly [infer C0 extends ColumnDef, infer C1 extends ColumnDef]
				? MergeColPair<OneCol<C0>, OneCol<C1>>
				: S extends readonly [
							infer C0 extends ColumnDef,
							infer C1 extends ColumnDef,
							infer C2 extends ColumnDef,
					  ]
					? MergeColPair<OneCol<C0>, MergeColPair<OneCol<C1>, OneCol<C2>>>
					: S extends readonly [
								infer C0 extends ColumnDef,
								infer C1 extends ColumnDef,
								infer C2 extends ColumnDef,
								infer C3 extends ColumnDef,
								...infer Rest extends readonly ColumnDef[],
						  ]
						? Rest extends readonly []
							? MergeColPair<MergeColPair<OneCol<C0>, OneCol<C1>>, MergeColPair<OneCol<C2>, OneCol<C3>>>
							: MergeColPair<
									MergeColPair<
										MergeColPair<OneCol<C0>, OneCol<C1>>,
										MergeColPair<OneCol<C2>, OneCol<C3>>
									>,
									ColumnsFromStack<Rest>
								>
						: { cols: {}; facts: {} }

/** The column type: NOT NULL by a constraint makes the type non-null. */
type ColType<C extends ColumnDef> = C[2] extends true
	? C[1]["nullable"] extends false
		? C[1]
		: NotNullType<C[1]>
	: C[1]

/** The column facts (CORE-1, CORE-18, PGT-6), or `never` when the column has none (it is then left out). */
type ColFact<C extends ColumnDef> = C[4] extends "identity"
	? { nullability: "not_null"; generated: true; identity: true }
	: C[4] extends true
		? C[2] extends true
			? { nullability: "not_null"; generated: true }
			: { generated: true }
		: C[2] extends true
			? C[3] extends true
				? { nullability: "not_null"; default: true }
				: { nullability: "not_null" }
			: C[3] extends true
				? { default: true }
				: never

/** Facts only for columns that have some: the key is `never` (dropped) for the others. */
type FactKey<C extends ColumnDef> = [ColFact<C>] extends [never] ? never : C[0]

/**
 * TLVL-4, #142: 80 or more columns: the columns and facts in ONE mapped type over the union of the columns (key remapping by
 * name), with no recursion over the column count. The chunked merge above nests one level per 4 columns and fails
 * at about 170 columns; this one is deeper per use on small tables, so it is only taken when the stack is wide. The 80 is measured: the chunked merge still works at 150 columns (606k
 * instantiations vs 560k here) but TS2589 hits it at about 170, and the mapped type broke an ALTER TABLE chain test when
 * used for every table, so it starts well under the failing size. Test: test/stress/wide-table-300.
 */
type WideColumnsFromStack<S extends readonly ColumnDef[]> = {
	cols: { [C in S[number] as C[0]]: ColType<C> }
	facts: { [C in S[number] as FactKey<C>]: ColFact<C> }
}
