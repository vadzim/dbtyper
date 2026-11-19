import type { ScalarExprAst, ScalarIdentParts } from "./parse-expression.ts"
import type { KnownAggregateName } from "./parse-select.ts"
import type { AstEqualsGroupKey, GroupKeySetContainsColParts } from "./parse-select-grouped.ts"

type TypeBoolAnd<A, B> = A extends true ? (B extends true ? true : false) : false

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

export type ExprValidInsideGroupedSelection<
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
