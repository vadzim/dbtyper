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
	Db,
	Args extends readonly (ScalarExprAst | { kind: "star" })[],
	GroupKeys extends readonly ScalarExprAst[],
	InsideAgg extends boolean,
> = Args extends readonly [infer A, ...infer R extends readonly (ScalarExprAst | { kind: "star" })[]]
	? A extends { kind: "star" }
		? FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
		: A extends ScalarExprAst
			? ExprValidInsideGroupedSelection<Db, A, GroupKeys, InsideAgg> extends true
				? FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
				: false
			: FnArgsGroupedCheck<Db, R, GroupKeys, InsideAgg>
	: true

type ExprValidInsideGroupedSelection<
	Db,
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
						? KnownAggregateName<Db, N, Args> extends true
							? FnArgsGroupedCheck<Db, Args, GroupKeys, true>
							: FnArgsGroupedCheck<Db, Args, GroupKeys, false>
						: Ast extends { kind: "neg"; inner: infer I extends ScalarExprAst }
							? ExprValidInsideGroupedSelection<Db, I, GroupKeys, false>
							: Ast extends {
										kind: "add"
										left: infer L extends ScalarExprAst
										right: infer R extends ScalarExprAst
								  }
								? TypeBoolAnd<
										ExprValidInsideGroupedSelection<Db, L, GroupKeys, false>,
										ExprValidInsideGroupedSelection<Db, R, GroupKeys, false>
									>
								: Ast extends {
											kind: "sub"
											left: infer Ls extends ScalarExprAst
											right: infer Rs extends ScalarExprAst
									  }
									? TypeBoolAnd<
											ExprValidInsideGroupedSelection<Db, Ls, GroupKeys, false>,
											ExprValidInsideGroupedSelection<Db, Rs, GroupKeys, false>
										>
									: Ast extends {
												kind: "mul"
												left: infer Lm extends ScalarExprAst
												right: infer Rm extends ScalarExprAst
										  }
										? TypeBoolAnd<
												ExprValidInsideGroupedSelection<Db, Lm, GroupKeys, false>,
												ExprValidInsideGroupedSelection<Db, Rm, GroupKeys, false>
											>
										: Ast extends {
													kind: "exp" | "mod"
													left: infer Le extends ScalarExprAst
													right: infer Re extends ScalarExprAst
											  }
											? TypeBoolAnd<
													ExprValidInsideGroupedSelection<Db, Le, GroupKeys, false>,
													ExprValidInsideGroupedSelection<Db, Re, GroupKeys, false>
												>
											: Ast extends { kind: "not"; inner: infer In extends ScalarExprAst }
												? ExprValidInsideGroupedSelection<Db, In, GroupKeys, false>
												: Ast extends {
															kind: "and" | "or"
															left: infer La extends ScalarExprAst
															right: infer Ra extends ScalarExprAst
													  }
													? TypeBoolAnd<
															ExprValidInsideGroupedSelection<Db, La, GroupKeys, false>,
															ExprValidInsideGroupedSelection<Db, Ra, GroupKeys, false>
														>
													: Ast extends {
																kind: "cmp" | "is_cmp"
																left: infer Lc extends ScalarExprAst
																right: infer Rc extends ScalarExprAst
														  }
														? TypeBoolAnd<
																ExprValidInsideGroupedSelection<
																	Db,
																	Lc,
																	GroupKeys,
																	false
																>,
																ExprValidInsideGroupedSelection<
																	Db,
																	Rc,
																	GroupKeys,
																	false
																>
															>
														: Ast extends {
																	kind: "between"
																	expr: infer Eb extends ScalarExprAst
																	low: infer Lb extends ScalarExprAst
																	high: infer Hb extends ScalarExprAst
															  }
															? TypeBoolAnd<
																	ExprValidInsideGroupedSelection<
																		Db,
																		Eb,
																		GroupKeys,
																		false
																	>,
																	TypeBoolAnd<
																		ExprValidInsideGroupedSelection<
																			Db,
																			Lb,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Db,
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
																			Db,
																			Ex,
																			GroupKeys,
																			false
																		>,
																		ExprValidInsideGroupedSelection<
																			Db,
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
																			Db,
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
																				Db,
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
																						Db,
																						HIn,
																						GroupKeys,
																						false
																					> extends true
																					? TIn extends readonly []
																						? true
																						: ExprValidInsideGroupedSelection<
																								Db,
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
																					Db,
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
																						Db,
																						Arms,
																						GroupKeys
																					> extends true
																					? ExprValidInsideGroupedSelection<
																							Db,
																							Dsc,
																							GroupKeys,
																							false
																						> extends true
																						? El extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									Db,
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
																							Db,
																							Arms2,
																							GroupKeys
																						> extends true
																						? El2 extends ScalarExprAst
																							? ExprValidInsideGroupedSelection<
																									Db,
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
																									Db,
																									B,
																									GroupKeys,
																									false
																								>,
																								ExprValidInsideGroupedSelection<
																									Db,
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
																									Db,
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
																											Db,
																											Lc,
																											GroupKeys,
																											false
																										>,
																										ExprValidInsideGroupedSelection<
																											Db,
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
																											Db,
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
	Db,
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
				ExprValidInsideGroupedSelection<Db, Arm["when"], GroupKeys, false>,
				ExprValidInsideGroupedSelection<Db, Arm["then"], GroupKeys, false>
			>,
			Rest extends readonly [] ? true : CaseArmsGroupedValid<Db, Rest, GroupKeys>
		>
	: true

type ArrayCtorEltsGroupedValid<
	Db,
	Els extends readonly ScalarExprAst[],
	GroupKeys extends readonly ScalarExprAst[],
> = Els extends readonly [infer H extends ScalarExprAst, ...infer T extends readonly ScalarExprAst[]]
	? ExprValidInsideGroupedSelection<Db, H, GroupKeys, false> extends true
		? T extends readonly []
			? true
			: ArrayCtorEltsGroupedValid<Db, T, GroupKeys>
		: false
	: true

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

type SelectItemsNeedGroupedProjRules<
	Db,
	Meta extends SelectGroupClauseMeta,
	Items extends readonly RawSelectItem[],
> = Meta["has_having_clause"] extends true
	? true
	: Meta["have_explicit_group_by"] extends true
		? true
		: RawSelectItemsHaveAggregateCall<Db, Items>

type RawSelectItemsHaveAggregateCall<Db, Items extends readonly RawSelectItem[]> = Items extends readonly [
	infer H extends RawSelectItem,
	...infer R extends readonly RawSelectItem[],
]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? AstContainsAggregateCall<Db, Ast> extends true
			? true
			: RawSelectItemsHaveAggregateCall<Db, R>
		: RawSelectItemsHaveAggregateCall<Db, R>
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
	Db,
	Items extends readonly RawSelectItem[],
	GroupKeys extends readonly ScalarExprAst[],
> = Items extends readonly [infer H extends RawSelectItem, ...infer Rest extends readonly RawSelectItem[]]
	? H extends { kind: "expr"; ast: infer Ast extends ScalarExprAst }
		? ExprValidInsideGroupedSelection<Db, Ast, GroupKeys, false> extends true
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: FormatError<Errors["GROUPED_SELECT_REQUIRES_COLUMN_TO_APPEAR_IN_GROUP_BY_OR_INSIDE_AN_AGGREGATE"], []>
		: H extends { kind: "star" } | { kind: "param" }
			? ValidateGroupedSelectItemsAgainstKeys<Db, Rest, GroupKeys>
			: never
	: true

export type GroupedProjValidationOutcome<
	Db,
	Items extends readonly RawSelectItem[],
	Meta extends SelectGroupClauseMeta,
> =
	DialectFact<Db, "groupByRule"> extends false
		? true // SQLT-28: SQLite allows bare columns next to an aggregate
		: SelectItemsNeedGroupedProjRules<Db, Meta, Items> extends true
			? GroupKeysWithPositionsResolved<Meta["group_key_asts"], Items> extends infer Keys extends
					readonly ScalarExprAst[]
				? ValidateGroupedSelectItemsAgainstKeys<Db, Items, Keys>
				: never
			: true
