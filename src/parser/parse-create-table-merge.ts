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
export type ColumnsFromStack<S extends readonly ColumnDef[]> = S extends readonly []
	? { cols: {}; facts: {} }
	: S extends readonly [infer C0 extends ColumnDef]
		? OneCol<C0>
		: S extends readonly [infer C0 extends ColumnDef, infer C1 extends ColumnDef]
			? MergeColPair<OneCol<C0>, OneCol<C1>>
			: S extends readonly [infer C0 extends ColumnDef, infer C1 extends ColumnDef, infer C2 extends ColumnDef]
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
