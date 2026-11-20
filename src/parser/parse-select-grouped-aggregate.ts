import type { SelectGroupClauseMeta } from "./parse-select-group-by.ts"
import type { ScalarExprAst } from "./parse-expression.ts"
import type { RawSelectItem } from "./parse-select.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { IsAggregateCall } from "./function-catalog.ts"

/**
 * An aggregate call: the `"aggregate"` kind of the function's row in the catalog of the chain's dialect
 * (`functionCatalog` fact, src/parser/function-catalog.ts).
 */
export type KnownAggregateName<Db, N extends string, Args extends readonly unknown[]> = IsAggregateCall<
	DialectFact<Db, "functionCatalog">,
	Lowercase<N>,
	Args["length"]
>

type AstContainsAggregateCall<Db, Ast extends ScalarExprAst> = Ast extends {
	kind: "function_call"
	name: infer N extends string
	args: infer Args extends readonly unknown[]
}
	? KnownAggregateName<Db, N, Args> extends true
		? true
		: false
	: Ast extends {
				kind: "add" | "sub" | "mul" | "exp" | "mod"
				left: infer L extends ScalarExprAst
				right: infer R extends ScalarExprAst
		  }
		? AstContainsAggregateCall<Db, L> extends true
			? true
			: AstContainsAggregateCall<Db, R>
		: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
			? AstContainsAggregateCall<Db, I>
			: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
				? AstContainsAggregateCall<Db, In>
				: Ast extends {
							kind: "and" | "or" | "cmp" | "is_cmp"
							left: infer La extends ScalarExprAst
							right: infer Ra extends ScalarExprAst
					  }
					? AstContainsAggregateCall<Db, La> extends true
						? true
						: AstContainsAggregateCall<Db, Ra>
					: Ast extends {
								kind: "between"
								expr: infer Eb extends ScalarExprAst
								low: infer Lb extends ScalarExprAst
								high: infer Hb extends ScalarExprAst
						  }
						? AstContainsAggregateCall<Db, Eb> extends true
							? true
							: AstContainsAggregateCall<Db, Lb> extends true
								? true
								: AstContainsAggregateCall<Db, Hb>
						: Ast extends {
									kind: "like" | "pg_regex_match"
									expr: infer Ex extends ScalarExprAst
									pattern: infer Pat extends ScalarExprAst
							  }
							? AstContainsAggregateCall<Db, Ex> extends true
								? true
								: AstContainsAggregateCall<Db, Pat>
							: Ast extends { kind: "is_null" | "is_not_null"; expr: infer En extends ScalarExprAst }
								? AstContainsAggregateCall<Db, En>
								: Ast extends {
											kind: "in_list"
											expr: infer El extends ScalarExprAst
											items: infer Ins extends readonly ScalarExprAst[]
									  }
									? AstContainsAggregateCall<Db, El> extends true
										? true
										: Ins extends readonly [
													infer H extends ScalarExprAst,
													...infer T extends readonly ScalarExprAst[],
											  ]
											? AstContainsAggregateCall<Db, H> extends true
												? true
												: T extends readonly []
													? false
													: AstContainsAggregateCall<
															Db,
															{ kind: "in_list"; expr: El; items: T }
														>
											: false
									: Ast extends {
												kind: "pg_cast" | "sql_cast"
												expr: infer Ex2 extends ScalarExprAst
										  }
										? AstContainsAggregateCall<Db, Ex2>
										: Ast extends {
													kind: "case_simple"
													discriminant: infer D extends ScalarExprAst
													arms: infer Arms extends readonly {
														when: ScalarExprAst
														then: ScalarExprAst
													}[]
													else_: infer Elc extends ScalarExprAst | null
											  }
											? AstContainsAggregateCall<Db, D> extends true
												? true
												: CaseArmsContainAgg<Db, Arms> extends true
													? true
													: Elc extends ScalarExprAst
														? AstContainsAggregateCall<Db, Elc>
														: false
											: Ast extends {
														kind: "case_searched"
														arms: infer Arms2 extends readonly {
															when: ScalarExprAst
															then: ScalarExprAst
														}[]
														else_: infer Elc2 extends ScalarExprAst | null
												  }
												? CaseArmsContainAgg<Db, Arms2> extends true
													? true
													: Elc2 extends ScalarExprAst
														? AstContainsAggregateCall<Db, Elc2>
														: false
												: Ast extends {
															kind: "array_index"
															base: infer B extends ScalarExprAst
															index: infer Id extends ScalarExprAst
													  }
													? AstContainsAggregateCall<Db, B> extends true
														? true
														: AstContainsAggregateCall<Db, Id>
													: Ast extends {
																kind: "array_ctor"
																elements: infer Els extends readonly ScalarExprAst[]
														  }
														? ArrayCtorContainsAgg<Db, Els>
														: Ast extends {
																	kind: "custom_op"
																	left: infer Lc extends ScalarExprAst
																	right: infer Rc extends ScalarExprAst
															  }
															? AstContainsAggregateCall<Db, Lc> extends true
																? true
																: AstContainsAggregateCall<Db, Rc>
															: Ast extends {
																		kind: "in_subquery"
																		expr?: infer Lex extends ScalarExprAst
																  }
																? Lex extends ScalarExprAst
																	? AstContainsAggregateCall<Db, Lex>
																	: false
																: false

type CaseArmsContainAgg<
	Db,
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? AstContainsAggregateCall<Db, Arm["when"]> extends true
		? true
		: AstContainsAggregateCall<Db, Arm["then"]> extends true
			? true
			: Rest extends readonly []
				? false
				: CaseArmsContainAgg<Db, Rest>
	: false

type ArrayCtorContainsAgg<Db, Els extends readonly ScalarExprAst[]> = Els extends readonly [
	infer H extends ScalarExprAst,
	...infer T extends readonly ScalarExprAst[],
]
	? AstContainsAggregateCall<Db, H> extends true
		? true
		: T extends readonly []
			? false
			: ArrayCtorContainsAgg<Db, T>
	: false

export type SelectItemsNeedGroupedProjRules<
	Db,
	Meta extends SelectGroupClauseMeta,
	Items extends readonly RawSelectItem[],
> = Meta["has_having_clause"] extends true
	? true
	: Meta["have_explicit_group_by"] extends true
		? true
		: RawSelectItemsHaveAggregateCall<Db, Items>

/** Walks the items by index and hands each to a helper (splitting the tuple per step is quadratic, #179 item 2). */
type RawSelectItemsHaveAggregateCall<
	Db,
	Items extends readonly RawSelectItem[],
	Before extends readonly 1[] = [],
> = Before["length"] extends Items["length"]
	? false
	: RawSelectItemHasAggregateCall<Db, Items[Before["length"]]> extends true
		? true
		: RawSelectItemsHaveAggregateCall<Db, Items, [...Before, 1]>

type RawSelectItemHasAggregateCall<Db, H> = H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
	? AstContainsAggregateCall<Db, Ast>
	: false
