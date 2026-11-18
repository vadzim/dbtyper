import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ScalarExprAst, ScalarIdentParts } from "./parse-expression.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { KnownAggregateName, RawSelectItem } from "./parse-select.ts"
import type { SelectGroupClauseMeta } from "./parse-select-group-by.ts"

type TypeBoolAnd<A, B> = A extends true ? (B extends true ? true : false) : false

type AstColPartsMatchGroupKey<KeyAst extends ScalarExprAst, Parts extends ScalarIdentParts> = KeyAst extends {
	kind: "col"
	parts: infer Q extends ScalarIdentParts
}
	? [Q] extends [Parts]
		? true
		: [Parts] extends [Q]
			? true
			: false
	: false

type GroupKeySetContainsColParts<
	Parts extends ScalarIdentParts,
	Keys extends readonly ScalarExprAst[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer Rest extends readonly ScalarExprAst[]]
	? AstColPartsMatchGroupKey<K, Parts> extends true
		? true
		: GroupKeySetContainsColParts<Parts, Rest>
	: false

type FnArgsGroupedCheck<
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = Args extends readonly [infer A, ...infer R extends readonly (ScalarExprAst | { kind: "star" })[]]
	? A extends { kind: "star" }
		? FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
		: A extends ScalarExprAst
			? ExprValidInsideGroupedSelection<A, GroupKeys, InsideAgg> extends true
				? FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
				: false
			: FnArgsGroupedCheck<R, GroupKeys, InsideAgg>
	: true

type ExprValidInsideGroupedSelection<
	Ast extends ScalarExprAst,
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = InsideAgg extends true
	? true
	: AstEqualsGroupKey<Ast, GroupKeys> extends true
		? true
		: Ast extends
					| { kind: "true" }
					| { kind: "false" }
					| { kind: "sql_null" }
					| { kind: "string" }
					| { kind: "number" }
			? true
			: Ast extends { kind: "param" }
				? false
				: Ast extends { kind: "col"; parts: infer P extends ScalarIdentParts }
					? GroupKeySetContainsColParts<P, GroupKeys>
					: Ast extends {
								kind: "function_call"
								name: infer N extends string
								args: infer Args extends readonly (ScalarExprAst | { kind: "star" })[]
						  }
						? KnownAggregateName<N, Args> extends true
							? FnArgsGroupedCheck<Args, GroupKeys, true>
							: FnArgsGroupedCheck<Args, GroupKeys, false>
						: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
							? ExprValidInsideGroupedSelection<I, GroupKeys, false>
							: Ast extends {
										kind: "add"
										left: infer L extends ScalarExprAst
										right: infer R extends ScalarExprAst
								  }
								? TypeBoolAnd<
										ExprValidInsideGroupedSelection<L, GroupKeys, false>,
										ExprValidInsideGroupedSelection<R, GroupKeys, false>
									>
								: Ast extends {
											kind: "sub"
											left: infer Ls extends ScalarExprAst
											right: infer Rs extends ScalarExprAst
									  }
									? TypeBoolAnd<
											ExprValidInsideGroupedSelection<Ls, GroupKeys, false>,
											ExprValidInsideGroupedSelection<Rs, GroupKeys, false>
										>
									: Ast extends {
												kind: "mul"
												left: infer Lm extends ScalarExprAst
												right: infer Rm extends ScalarExprAst
										  }
										? TypeBoolAnd<
												ExprValidInsideGroupedSelection<Lm, GroupKeys, false>,
												ExprValidInsideGroupedSelection<Rm, GroupKeys, false>
											>
										: Ast extends {
													kind: "exp" | "mod"
													left: infer Le extends ScalarExprAst
													right: infer Re extends ScalarExprAst
											  }
											? TypeBoolAnd<
													ExprValidInsideGroupedSelection<Le, GroupKeys, false>,
													ExprValidInsideGroupedSelection<Re, GroupKeys, false>
												>
											: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
												? ExprValidInsideGroupedSelection<In, GroupKeys, false>
												: Ast extends {
															kind: "and" | "or"
															left: infer La extends ScalarExprAst
															right: infer Ra extends ScalarExprAst
													  }
													? TypeBoolAnd<
															ExprValidInsideGroupedSelection<La, GroupKeys, false>,
															ExprValidInsideGroupedSelection<Ra, GroupKeys, false>
														>
													: Ast extends {
																kind: "cmp" | "is_cmp"
																left: infer Lc extends ScalarExprAst
																right: infer Rc extends ScalarExprAst
														  }
														? TypeBoolAnd<
																ExprValidInsideGroupedSelection<Lc, GroupKeys, false>,
																ExprValidInsideGroupedSelection<Rc, GroupKeys, false>
															>
														: Ast extends {
																	kind: "between"
																	expr: infer Eb extends ScalarExprAst
																	low: infer Lb extends ScalarExprAst
																	high: infer Hb extends ScalarExprAst
															  }
															? TypeBoolAnd<
																	ExprValidInsideGroupedSelection<
																		Eb,
																		GroupKeys,
																		false
																	>,
																	TypeBoolAnd<
																		ExprValidInsideGroupedSelection<
																			Lb,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Hb,
																			GroupKeys,
																			false
																		>
																	>
																>
															: Ast extends {
																		kind: "like" | "pg_regex_match"
																		expr: infer Ex extends ScalarExprAst
																		pattern: infer Pat extends ScalarExprAst
																  }
																? TypeBoolAnd<
																		ExprValidInsideGroupedSelection<
																			Ex,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Pat,
																			GroupKeys,
																			false
																		>
																	>
																: Ast extends {
																			kind: "is_null" | "is_not_null"
																			expr: infer En extends ScalarExprAst
																	  }
																	? ExprValidInsideGroupedSelection<
																			En,
																			GroupKeys,
																			false
																		>
																	: Ast extends {
																				kind: "in_list"
																				expr: infer El extends ScalarExprAst
																				items: infer Ins extends
																					readonly ScalarExprAst[]
																		  }
																		? ExprValidInsideGroupedSelection<
																				El,
																				GroupKeys,
																				false
																			> extends true
																			? Ins extends readonly [
																					infer HIn extends ScalarExprAst,
																					...infer TIn extends
																						readonly ScalarExprAst[],
																				]
																				? ExprValidInsideGroupedSelection<
																						HIn,
																						GroupKeys,
																						false
																					> extends true
																					? TIn extends readonly []
																						? true
																						: ExprValidInsideGroupedSelection<
																								{
																									kind: "in_list"
																									expr: El
																									items: TIn
																								},
																								GroupKeys,
																								false
																							>
																					: false
																				: true
																			: false
																		: Ast extends {
																					kind: "pg_cast" | "sql_cast"
																					expr: infer Xc extends ScalarExprAst
																			  }
																			? ExprValidInsideGroupedSelection<
																					Xc,
																					GroupKeys,
																					false
																				>
																			: Ast extends {
																						kind: "case_simple"
																						discriminant: infer Dsc extends
																							ScalarExprAst
																						arms: infer Arms extends
																							readonly {
																								when: ScalarExprAst
																								then: ScalarExprAst
																							}[]
																						else_: infer El extends
																							ScalarExprAst | null
																				  }
																				? CaseArmsGroupedValid<
																						Arms,
																						GroupKeys
																					> extends true
																					? ExprValidInsideGroupedSelection<
																							Dsc,
																							GroupKeys,
																							false
																						> extends true
																						? El extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									El,
																									GroupKeys,
																									false
																								>
																							: true
																						: false
																					: false
																				: Ast extends {
																							kind: "case_searched"
																							arms: infer Arms2 extends
																								readonly {
																									when: ScalarExprAst
																									then: ScalarExprAst
																								}[]
																							else_: infer El2 extends
																								ScalarExprAst | null
																					  }
																					? CaseArmsGroupedValid<
																							Arms2,
																							GroupKeys
																						> extends true
																						? El2 extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									El2,
																									GroupKeys,
																									false
																								>
																							: true
																						: false
																					: Ast extends {
																								kind: "array_index"
																								base: infer B extends
																									ScalarExprAst
																								index: infer Id extends
																									ScalarExprAst
																						  }
																						? TypeBoolAnd<
																								ExprValidInsideGroupedSelection<
																									B,
																									GroupKeys,
																									false
																								>,
																								ExprValidInsideGroupedSelection<
																									Id,
																									GroupKeys,
																									false
																								>
																							>
																						: Ast extends {
																									kind: "array_ctor"
																									elements: infer Els extends
																										readonly ScalarExprAst[]
																							  }
																							? ArrayCtorEltsGroupedValid<
																									Els,
																									GroupKeys
																								>
																							: Ast extends {
																										kind: "custom_op"
																										left: infer Lc extends
																											ScalarExprAst
																										right: infer Rc extends
																											ScalarExprAst
																								  }
																								? TypeBoolAnd<
																										ExprValidInsideGroupedSelection<
																											Lc,
																											GroupKeys,
																											false
																										>,
																										ExprValidInsideGroupedSelection<
																											Rc,
																											GroupKeys,
																											false
																										>
																									>
																								: Ast extends {
																											kind: "in_subquery"
																											expr: infer Ie extends
																												ScalarExprAst
																									  }
																									? ExprValidInsideGroupedSelection<
																											Ie,
																											GroupKeys,
																											false
																										>
																									: Ast extends {
																												kind:
																													| "scalar_subquery"
																													| "exists_subquery"
																										  }
																										? true
																										: false

type CaseArmsGroupedValid<
	Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	GroupKeys extends readonly ScalarExprAst[],
> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? TypeBoolAnd<
			TypeBoolAnd<
				ExprValidInsideGroupedSelection<Arm["when"], GroupKeys, false>,
				ExprValidInsideGroupedSelection<Arm["then"], GroupKeys, false>
			>,
			Rest extends readonly [] ? true : CaseArmsGroupedValid<Rest, GroupKeys>
		>
	: true

type ArrayCtorEltsGroupedValid<
	Els extends readonly ScalarExprAst[],
	GroupKeys extends readonly ScalarExprAst[],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ExprValidInsideGroupedSelection<H, GroupKeys, false> extends true
		? T extends readonly []
			? true
			: ArrayCtorEltsGroupedValid<T, GroupKeys>
		: false
	: true

type AstContainsAggregateCall<Ast extends ScalarExprAst> = Ast extends {
	kind: "function_call"
	name: infer N extends string
	args: infer Args extends readonly unknown[]
}
	? KnownAggregateName<N, Args> extends true
		? true
		: false
	: Ast extends {
				kind: "add" | "sub" | "mul" | "exp" | "mod"
				left: infer L extends ScalarExprAst
				right: infer R extends ScalarExprAst
		  }
		? AstContainsAggregateCall<L> extends true
			? true
			: AstContainsAggregateCall<R>
		: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
			? AstContainsAggregateCall<I>
			: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
				? AstContainsAggregateCall<In>
				: Ast extends {
							kind: "and" | "or" | "cmp" | "is_cmp"
							left: infer La extends ScalarExprAst
							right: infer Ra extends ScalarExprAst
					  }
					? AstContainsAggregateCall<La> extends true
						? true
						: AstContainsAggregateCall<Ra>
					: Ast extends {
								kind: "between"
								expr: infer Eb extends ScalarExprAst
								low: infer Lb extends ScalarExprAst
								high: infer Hb extends ScalarExprAst
						  }
						? AstContainsAggregateCall<Eb> extends true
							? true
							: AstContainsAggregateCall<Lb> extends true
								? true
								: AstContainsAggregateCall<Hb>
						: Ast extends {
									kind: "like" | "pg_regex_match"
									expr: infer Ex extends ScalarExprAst
									pattern: infer Pat extends ScalarExprAst
							  }
							? AstContainsAggregateCall<Ex> extends true
								? true
								: AstContainsAggregateCall<Pat>
							: Ast extends { kind: "is_null" | "is_not_null"; expr: infer En extends ScalarExprAst }
								? AstContainsAggregateCall<En>
								: Ast extends {
											kind: "in_list"
											expr: infer El extends ScalarExprAst
											items: infer Ins extends readonly ScalarExprAst[]
									  }
									? AstContainsAggregateCall<El> extends true
										? true
										: Ins extends readonly [
													infer H extends ScalarExprAst,
													...infer T extends readonly ScalarExprAst[],
											  ]
											? AstContainsAggregateCall<H> extends true
												? true
												: T extends readonly []
													? false
													: AstContainsAggregateCall<{ kind: "in_list"; expr: El; items: T }>
											: false
									: Ast extends {
												kind: "pg_cast" | "sql_cast"
												expr: infer Ex2 extends ScalarExprAst
										  }
										? AstContainsAggregateCall<Ex2>
										: Ast extends {
													kind: "case_simple"
													discriminant: infer D extends ScalarExprAst
													arms: infer Arms extends readonly {
														when: ScalarExprAst
														then: ScalarExprAst
													}[]
													else_: infer Elc extends ScalarExprAst | null
											  }
											? AstContainsAggregateCall<D> extends true
												? true
												: CaseArmsContainAgg<Arms> extends true
													? true
													: Elc extends ScalarExprAst
														? AstContainsAggregateCall<Elc>
														: false
											: Ast extends {
														kind: "case_searched"
														arms: infer Arms2 extends readonly {
															when: ScalarExprAst
															then: ScalarExprAst
														}[]
														else_: infer Elc2 extends ScalarExprAst | null
												  }
												? CaseArmsContainAgg<Arms2> extends true
													? true
													: Elc2 extends ScalarExprAst
														? AstContainsAggregateCall<Elc2>
														: false
												: Ast extends {
															kind: "array_index"
															base: infer B extends ScalarExprAst
															index: infer Id extends ScalarExprAst
													  }
													? AstContainsAggregateCall<B> extends true
														? true
														: AstContainsAggregateCall<Id>
													: Ast extends {
																kind: "array_ctor"
																elements: infer Els extends readonly ScalarExprAst[]
														  }
														? ArrayCtorContainsAgg<Els>
														: Ast extends {
																	kind: "custom_op"
																	left: infer Lc extends ScalarExprAst
																	right: infer Rc extends ScalarExprAst
															  }
															? AstContainsAggregateCall<Lc> extends true
																? true
																: AstContainsAggregateCall<Rc>
															: Ast extends {
																		kind: "in_subquery"
																		expr?: infer Lex extends ScalarExprAst
																  }
																? Lex extends ScalarExprAst
																	? AstContainsAggregateCall<Lex>
																	: false
																: false

type CaseArmsContainAgg<Arms extends readonly { when: ScalarExprAst; then: ScalarExprAst }[]> = Arms extends readonly [
	infer Arm extends { when: ScalarExprAst; then: ScalarExprAst },
	...infer Rest extends readonly {
		when: ScalarExprAst
		then: ScalarExprAst
	}[],
]
	? AstContainsAggregateCall<Arm["when"]> extends true
		? true
		: AstContainsAggregateCall<Arm["then"]> extends true
			? true
			: Rest extends readonly []
				? false
				: CaseArmsContainAgg<Rest>
	: false

type ArrayCtorContainsAgg<Els extends readonly ScalarExprAst[]> = Els extends readonly [
	infer H extends ScalarExprAst,
	...infer T extends readonly ScalarExprAst[],
]
	? AstContainsAggregateCall<H> extends true
		? true
		: T extends readonly []
			? false
			: ArrayCtorContainsAgg<T>
	: false

type SelectItemsNeedGroupedProjRules<
	Meta extends SelectGroupClauseMeta,
	Items extends readonly RawSelectItem[],
> = Meta["has_having_clause"] extends true
	? true
	: Meta["have_explicit_group_by"] extends true
		? true
		: RawSelectItemsHaveAggregateCall<Items>

type RawSelectItemsHaveAggregateCall<Items extends readonly RawSelectItem[]> = Items extends readonly [
	infer H extends RawSelectItem,
	...infer R extends readonly RawSelectItem[],
]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? AstContainsAggregateCall<Ast> extends true
			? true
			: RawSelectItemsHaveAggregateCall<R>
		: RawSelectItemsHaveAggregateCall<R>
	: false

/** SEL-28: output-column position of an expression select item (`1` is the first item), `never` otherwise. */
type SelectItemAstAtPosition<
	Items extends readonly RawSelectItem[],
	Pos extends string,
	Counter extends readonly 1[] = readonly [1],
> = Items extends readonly [infer H extends RawSelectItem, ...infer R extends readonly RawSelectItem[]]
	? `${Counter["length"]}` extends Pos
		? H extends { kind: "expr"; ast: infer A extends ScalarExprAst }
			? A
			: never
		: SelectItemAstAtPosition<R, Pos, readonly [...Counter, 1]>
	: never

/** SEL-28: replace an integer-literal GROUP BY key by the select item at that position. */
type GroupKeysWithPositionsResolved<
	Keys extends readonly ScalarExprAst[],
	Items extends readonly RawSelectItem[],
> = Keys extends readonly [infer K extends ScalarExprAst, ...infer R extends readonly ScalarExprAst[]]
	? [
			K extends { kind: "number"; raw: infer Raw extends string }
				? SelectItemAstAtPosition<Items, Raw> extends infer A
					? [A] extends [never]
						? K
						: A
					: K
				: K,
			...GroupKeysWithPositionsResolved<R, Items>,
		]
	: readonly []

type AstEqualsGroupKey<Ast extends ScalarExprAst, Keys extends readonly ScalarExprAst[]> = Keys extends readonly [
	infer K extends ScalarExprAst,
	...infer R extends readonly ScalarExprAst[],
]
	? [Ast] extends [K]
		? [K] extends [Ast]
			? true
			: AstEqualsGroupKey<Ast, R>
		: AstEqualsGroupKey<Ast, R>
	: false

type ValidateGroupedSelectItemsAgainstKeys<
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
> = Items extends readonly [infer H extends RawSelectItem, ...infer Rest extends readonly RawSelectItem[]]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? ExprValidInsideGroupedSelection<Ast, GroupKeys, false> extends true
			? ValidateGroupedSelectItemsAgainstKeys<Rest, GroupKeys>
			: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Rest, GroupKeys>
			: never
	: true

export type GroupedProjValidationOutcome<
	Db,
	Items extends readonly RawSelectItem[],
	Meta extends SelectGroupClauseMeta,
> =
	DialectFact<Db, "groupByRule"> extends false
		? true // SQLT-28: SQLite allows bare columns next to an aggregate
		: SelectItemsNeedGroupedProjRules<Meta, Items> extends true
			? GroupKeysWithPositionsResolved<Meta["group_key_asts"], Items> extends infer Keys extends
					readonly ScalarExprAst[]
				? ValidateGroupedSelectItemsAgainstKeys<Items, Keys>
				: never
			: true
