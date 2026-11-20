import type { DbDialectOnlyError, DialectFact } from "../core/dialect.ts"
import type { JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { ParseParenEnclosedSelect } from "./parse-select-subquery.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarCmpOp, ScalarExprAst } from "./parse-expression-ast.ts"
import type {
	TokenToCmpOp,
	ParseInListUntypedAfterInKw,
	ParseBetweenAfterL,
	ParseLikeAfterL,
	ParseNotPostfix,
} from "./parse-expression-predicates.ts"
import type { ParseOrScalarUntyped } from "./parse-expression-bool.ts"
import type { ParseOtherOpScalarUntyped } from "./parse-expression-arith.ts"

type ParseAfterIsUntyped<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"not">
		? SkipToken<Tokens> extends infer R5 extends ParserMonad
			? PeekToken<R5> extends TokenKey<"null">
				? [SkipToken<R5>, { kind: "is_not_null"; expr: L }, Env]
				: IsValueAllowed<PeekToken<R5>, Env> extends true
					? ParseIsValueOperand<R5, L, Env>
					: SkipFailedExpressionWithEnv<R5, FormatError<Errors["EXPECTED_NULL_AFTER_IS_NOT"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"null">
			? [SkipToken<Tokens>, { kind: "is_null"; expr: L }, Env]
			: IsValueAllowed<PeekToken<Tokens>, Env> extends true
				? ParseIsValueOperand<Tokens, L, Env>
				: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_NULL_AFTER_IS"], []>, Env>

/** `IS [NOT] DISTINCT FROM` is standard SQL (CORE-2, both dialects); a bare value after `IS [NOT]` is the `isOperand` dialect fact. */
type IsValueAllowed<Next, Env extends ExprParseEnv> =
	DialectFact<Env["db"], "isOperand"> extends "value" ? true : Next extends TokenKey<"distinct"> ? true : false

/** SQLT-33: `a IS [NOT] b` and `a IS [NOT] DISTINCT FROM b`: any value on the right; the result is never NULL. */
type ParseIsValueOperand<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"distinct">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenKey<"from">
				? ParseIsRhs<SkipToken<R1>, L, Env>
				: SkipFailedExpressionWithEnv<R1, FormatError<Errors["EXPECTED_FROM_AFTER_IS_DISTINCT"], []>, Env>
			: never
		: ParseIsRhs<Tokens, L, Env>

type ParseIsRhs<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer Rhs,
		infer Env1 extends ExprParseEnv,
	]
		? Rhs extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, Rhs, Env1>
			: [R1, { kind: "is_cmp"; left: L; right: Rhs }, Env1]
		: never

type IsRelOp<T> =
	T extends TokenKey<"=">
		? true
		: T extends TokenKey<"<>">
			? true
			: T extends TokenKey<"!=">
				? true
				: T extends TokenKey<"<=">
					? true
					: T extends TokenKey<">=">
						? true
						: T extends TokenKey<"<">
							? true
							: T extends TokenKey<">">
								? true
								: false

type ParseAnyAllSomeAfterOp<Tokens extends ParserMonad, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	DbDialectOnlyError<Env["db"], "pg-any-all-some"> extends infer OnlyErr extends DbtyperErrorShape
		? SkipFailedExpressionWithEnv<Tokens, OnlyErr, Env>
		: ParseAnyAllSomeAfterOpPg<Tokens, L, OpToken, Env>

type ParseAnyAllSomeAfterOpPg<Tokens extends ParserMonad, L extends ScalarExprAst, OpToken, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends infer Kw
		? Kw extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<"(">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"select">
							? ParseParenEnclosedSelect<R2, Env["db"], Env["params"], Env["outerScope"]> extends [
									infer R3 extends ParserMonad,
									infer Sub,
								]
								? Sub extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R3, Sub, Env>
									: Sub extends JsqlSelectStatementResult
										? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
											? Kw extends TokenKey<"any">
												? [R3, { kind: "any_op"; op: Op; left: L; right: Sub }, Env]
												: Kw extends TokenKey<"all">
													? [R3, { kind: "all_op"; op: Op; left: L; right: Sub }, Env]
													: Kw extends TokenKey<"some">
														? [R3, { kind: "some_op"; op: Op; left: L; right: Sub }, Env]
														: never
											: SkipFailedExpressionWithEnv<R3, never, Env>
										: never
								: never
							: ParseOrScalarUntyped<R2, Env> extends [
										infer R4 extends ParserMonad,
										infer ArrExpr,
										infer Env4 extends ExprParseEnv,
								  ]
								? ArrExpr extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<R4, ArrExpr, Env4>
									: ArrExpr extends ScalarExprAst
										? PeekToken<R4> extends TokenKey<")">
											? SkipToken<R4> extends infer R5 extends ParserMonad
												? TokenToCmpOp<OpToken> extends infer Op extends ScalarCmpOp
													? Kw extends TokenKey<"any">
														? [
																R5,
																{ kind: "any_op"; op: Op; left: L; right: ArrExpr },
																Env4,
															]
														: Kw extends TokenKey<"all">
															? [
																	R5,
																	{ kind: "all_op"; op: Op; left: L; right: ArrExpr },
																	Env4,
																]
															: Kw extends TokenKey<"some">
																? [
																		R5,
																		{
																			kind: "some_op"
																			op: Op
																			left: L
																			right: ArrExpr
																		},
																		Env4,
																	]
																: never
													: SkipFailedExpressionWithEnv<R5, never, Env4>
												: never
											: SkipFailedExpressionWithEnv<
													R4,
													FormatError<
														Errors["EXPECTED_CLOSE_PAREN_AFTER_ANY_ALL_SOME_EXPRESSION"],
														[]
													>,
													Env4
												>
										: never
								: never
						: never
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_ANY_ALL_SOME"], []>,
							Env
						>
				: never
			: never
		: never

export type ParseAfterAddScalarRelIsInUntyped<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? SkipToken<Tokens> extends infer R2 extends ParserMonad
				? PeekToken<R2> extends TokenKey<"any"> | TokenKey<"all"> | TokenKey<"some">
					? ParseAnyAllSomeAfterOp<R2, L, P, Env>
					: ParseOtherOpScalarUntyped<R2, Env> extends [
								infer R3 extends ParserMonad,
								infer Rhs,
								infer Env3 extends ExprParseEnv,
						  ]
						? Rhs extends DbtyperErrorShape
							? SkipFailedExpressionWithEnv<R3, Rhs, Env3>
							: TokenToCmpOp<P> extends infer Cop extends ScalarCmpOp
								? [R3, { kind: "cmp"; op: Cop; left: L; right: Rhs }, Env3]
								: SkipFailedExpressionWithEnv<R3, never, Env3>
						: never
				: never
			: P extends TokenKey<"is">
				? ParseAfterIsUntyped<SkipToken<Tokens>, L, Env>
				: P extends TokenKey<"in">
					? ParseInListUntypedAfterInKw<Tokens, L, Env>
					: P extends TokenKey<"between">
						? ParseBetweenAfterL<Tokens, L, Env>
						: P extends TokenKey<"~">
							? SkipToken<Tokens> extends infer Rregex extends ParserMonad
								? ParseOtherOpScalarUntyped<Rregex, Env> extends [
										infer Rrp extends ParserMonad,
										infer Pat,
										infer EnvRp extends ExprParseEnv,
									]
									? Pat extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rrp, Pat, EnvRp>
										: [
												Rrp,
												{
													kind: "pg_regex_match"
													expr: L
													pattern: Pat
													case_insensitive: false
												},
												EnvRp,
											]
									: never
								: never
							: P extends TokenKey<"~*">
								? SkipToken<Tokens> extends infer Rregexi extends ParserMonad
									? ParseOtherOpScalarUntyped<Rregexi, Env> extends [
											infer Rrpi extends ParserMonad,
											infer Pati,
											infer EnvRpi extends ExprParseEnv,
										]
										? Pati extends DbtyperErrorShape
											? SkipFailedExpressionWithEnv<Rrpi, Pati, EnvRpi>
											: [
													Rrpi,
													{
														kind: "pg_regex_match"
														expr: L
														pattern: Pati
														case_insensitive: true
													},
													EnvRpi,
												]
										: never
									: never
								: P extends TokenKey<"!~">
									? SkipToken<Tokens> extends infer Rnotregex extends ParserMonad
										? ParseOtherOpScalarUntyped<Rnotregex, Env> extends [
												infer Rrpn extends ParserMonad,
												infer Patn,
												infer EnvRpn extends ExprParseEnv,
											]
											? Patn extends DbtyperErrorShape
												? SkipFailedExpressionWithEnv<Rrpn, Patn, EnvRpn>
												: [
														Rrpn,
														{
															kind: "not"
															inner: {
																kind: "pg_regex_match"
																expr: L
																pattern: Patn
																case_insensitive: false
															}
														},
														EnvRpn,
													]
											: never
										: never
									: P extends TokenKey<"!~*">
										? SkipToken<Tokens> extends infer Rnotregexi extends ParserMonad
											? ParseOtherOpScalarUntyped<Rnotregexi, Env> extends [
													infer Rrpni extends ParserMonad,
													infer Patni,
													infer EnvRpni extends ExprParseEnv,
												]
												? Patni extends DbtyperErrorShape
													? SkipFailedExpressionWithEnv<Rrpni, Patni, EnvRpni>
													: [
															Rrpni,
															{
																kind: "not"
																inner: {
																	kind: "pg_regex_match"
																	expr: L
																	pattern: Patni
																	case_insensitive: true
																}
															},
															EnvRpni,
														]
												: never
											: never
										: P extends TokenKey<"like" | "similar">
											? ParseLikeAfterL<Tokens, L, false, Env>
											: P extends TokenKey<"ilike">
												? ParseLikeAfterL<Tokens, L, true, Env>
												: P extends TokenKey<"not">
													? Env extends { noPostfixNot: true }
														? [Tokens, L, Env] // `DEFAULT 18 NOT NULL`: NOT belongs to the column constraint
														: ParseNotPostfix<Tokens, L, Env>
													: P extends TokenIdent<"glob" | "regexp">
														? DialectFact<Env["db"], "globRegexp"> extends true
															? ParseLikeAfterL<Tokens, L, false, Env>
															: [Tokens, L, Env]
														: [Tokens, L, Env]
		: never

type ParseRelScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R1 extends ParserMonad,
		infer E1,
		infer Env1 extends ExprParseEnv,
	]
		? E1 extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E1, Env1>
			: E1 extends ScalarExprAst
				? ParseAfterAddScalarRelIsInUntyped<R1, E1, Env1>
				: never
		: never

export type ParseNotScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"exists">
		? SkipToken<Tokens> extends infer Rex0 extends ParserMonad
			? PeekToken<Rex0> extends TokenKey<"(">
				? SkipToken<Rex0> extends infer Rex1 extends ParserMonad
					? PeekToken<Rex1> extends TokenKey<"select">
						? ParseParenEnclosedSelect<Rex1, Env["db"], Env["params"], Env["outerScope"]> extends [
								infer Rex2 extends ParserMonad,
								infer Sub,
							]
							? Sub extends DbtyperErrorShape
								? SkipFailedExpressionWithEnv<Rex2, Sub, Env>
								: Sub extends JsqlSelectStatementResult
									? [Rex2, { kind: "exists_subquery"; sub: Sub }, Env]
									: never
							: never
						: SkipFailedExpressionWithEnv<
								Rex1,
								FormatError<Errors["EXPECTED_SELECT_IN_EXISTS_SUBQUERY"], []>,
								Env
							>
					: never
				: SkipFailedExpressionWithEnv<Rex0, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_EXISTS"], []>, Env>
			: never
		: PeekToken<Tokens> extends TokenKey<"not">
			? SkipToken<Tokens> extends infer Rn extends ParserMonad
				? ParseNotScalarUntyped<Rn, Env> extends [
						infer Ru extends ParserMonad,
						infer U,
						infer EnvU extends ExprParseEnv,
					]
					? U extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Ru, U, EnvU>
						: U extends ScalarExprAst
							? [Ru, { kind: "not"; inner: U }, EnvU]
							: never
					: never
				: never
			: ParseRelScalarUntyped<Tokens, Env>
