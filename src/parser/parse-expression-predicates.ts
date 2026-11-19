import type { JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { DbtyperErrorShape, Errors, FormatError } from "../dbtyper-error.ts"
import type { ParserMonad, PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { ParseParenEnclosedSelect } from "./parse-select-subquery.ts"
import type { SkipFailedExpressionWithEnv } from "./skip-statement.ts"
import type { ExprParseEnv, ScalarExprAst } from "./parse-expression-ast.ts"
import type { ParseOrScalarUntyped } from "./parse-expression-bool.ts"
import type { ParseScalarExprUntypedFromIdent, ParseScalarExprUntypedNonIdent } from "./parse-expression-primary.ts"
import type { ParseOtherOpScalarUntyped } from "./parse-expression-arith.ts"

/** Additive / multiplicative / unary-minus / primary (no `AND`/`OR`/`NOT`/comparisons at this level). */
export type ParseAddScalarUntyped<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<string>
		? ParseScalarExprUntypedFromIdent<Tokens, Env>
		: ParseScalarExprUntypedNonIdent<Tokens, Env>

export type TokenToCmpOp<Tok> =
	Tok extends TokenKey<"=">
		? "eq"
		: Tok extends TokenKey<"<>"> | TokenKey<"!=">
			? "ne"
			: Tok extends TokenKey<"<">
				? "lt"
				: Tok extends TokenKey<"<=">
					? "le"
					: Tok extends TokenKey<">">
						? "gt"
						: Tok extends TokenKey<">=">
							? "ge"
							: never

/** Comma-separated scalar expressions inside `IN (` … `)` (untyped AST for resolve). */
type ParseInListUntypedAccum<
	Tokens extends ParserMonad,
	Acc extends readonly ScalarExprAst[],
	Env extends ExprParseEnv,
> =
	ParseOrScalarUntyped<Tokens, Env> extends [infer R1 extends ParserMonad, infer E, infer Env1 extends ExprParseEnv]
		? E extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R1, E, Env1>
			: E extends ScalarExprAst
				? PeekToken<R1> extends TokenKey<")">
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? [R2, readonly [...Acc, E], Env1]
						: never
					: PeekToken<R1> extends TokenKey<",">
						? ParseInListUntypedAccum<SkipToken<R1>, readonly [...Acc, E], Env1>
						: SkipFailedExpressionWithEnv<
								R1,
								FormatError<Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_IN_LIST"], []>,
								Env1
							>
				: never
		: never

type ParseInListUntypedTail<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<")">
		? SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["IN_LIST_MUST_NOT_BE_EMPTY"], []>, Env>
		: PeekToken<Tokens> extends TokenKey<"select">
			? ParseParenEnclosedSelect<Tokens, Env["db"], Env["params"], Env["outerScope"]> extends [
					infer R9 extends ParserMonad,
					infer Sub,
				]
				? Sub extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<R9, Sub, Env>
					: Sub extends JsqlSelectStatementResult
						? [R9, Sub, Env]
						: never
				: never
			: ParseInListUntypedAccum<Tokens, readonly [], Env>

export type ParseInListUntypedAfterInKw<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"in">
		? SkipToken<Tokens> extends infer R8 extends ParserMonad
			? PeekToken<R8> extends TokenKey<"(">
				? ParseInListUntypedTail<SkipToken<R8>, Env> extends [
						infer R9 extends ParserMonad,
						infer ListRes,
						infer Env9 extends ExprParseEnv,
					]
					? ListRes extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R9, ListRes, Env9>
						: ListRes extends JsqlSelectStatementResult
							? [R9, { kind: "in_subquery"; expr: L; sub: ListRes }, Env9]
							: ListRes extends readonly ScalarExprAst[]
								? [R9, { kind: "in_list"; expr: L; items: ListRes }, Env9]
								: never
					: never
				: SkipFailedExpressionWithEnv<R8, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_IN"], []>, Env>
			: never
		: never

export type ParseBetweenAfterL<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"between">
		? SkipToken<Tokens> extends infer Rb extends ParserMonad
			? ParseAddScalarUntyped<Rb, Env> extends [
					infer Rlow extends ParserMonad,
					infer Low,
					infer EnvLow extends ExprParseEnv,
				]
				? Low extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rlow, Low, EnvLow>
					: PeekToken<Rlow> extends TokenKey<"and">
						? SkipToken<Rlow> extends infer Ra extends ParserMonad
							? ParseOtherOpScalarUntyped<Ra, EnvLow> extends [
									infer Rh extends ParserMonad,
									infer High,
									infer EnvH extends ExprParseEnv,
								]
								? High extends DbtyperErrorShape
									? SkipFailedExpressionWithEnv<Rh, High, EnvH>
									: [Rh, { kind: "between"; expr: L; low: Low; high: High }, EnvH]
								: never
							: never
						: SkipFailedExpressionWithEnv<
								Rlow,
								FormatError<Errors["EXPECTED_AND_BETWEEN_BETWEEN_BOUNDS"], []>,
								EnvLow
							>
				: never
			: never
		: never

export type ParseLikeAfterL<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	CI extends boolean,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends infer TokKw
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokKw extends TokenKey<"similar">
				? PeekToken<R1> extends TokenKey<"to"> // PGT-23: `x SIMILAR TO pattern`
					? ParseLikePattern<SkipToken<R1>, L, CI, Env>
					: SkipFailedExpressionWithEnv<R1, FormatError<Errors["UNEXPECTED_TOKEN"], ["SIMILAR"]>, Env>
				: TokKw extends TokenIdent<"regexp">
					? // SQLT-34: always an error until users can declare functions (FN-Q1)
						SkipFailedExpressionWithEnv<R1, FormatError<Errors["REGEXP_NEEDS_FUNCTION"], []>, Env>
					: ParseLikePattern<R1, L, CI, Env>
			: never
		: never

type ParseLikePattern<
	Tokens extends ParserMonad,
	L extends ScalarExprAst,
	CI extends boolean,
	Env extends ExprParseEnv,
> =
	ParseOtherOpScalarUntyped<Tokens, Env> extends [
		infer R2 extends ParserMonad,
		infer Pat,
		infer Env2 extends ExprParseEnv,
	]
		? Pat extends DbtyperErrorShape
			? SkipFailedExpressionWithEnv<R2, Pat, Env2>
			: PeekToken<R2> extends TokenIdent<"escape">
				? ParseOtherOpScalarUntyped<SkipToken<R2>, Env2> extends [
						infer R3 extends ParserMonad,
						infer Esc,
						infer Env3 extends ExprParseEnv,
					]
					? Esc extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<R3, Esc, Env3>
						: [R3, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }, Env3]
					: never
				: [R2, { kind: "like"; expr: L; pattern: Pat; case_insensitive: CI }, Env2]
		: never

/** `x NOT LIKE | GLOB | REGEXP | IN | BETWEEN …`: the positive form, negated. `Tokens` is at `NOT`. */
export type ParseNotPostfix<Tokens extends ParserMonad, L extends ScalarExprAst, Env extends ExprParseEnv> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? PeekToken<R1> extends TokenKey<"like" | "similar"> | TokenIdent<"glob" | "regexp">
			? ParseLikeAfterL<R1, L, false, Env> extends [
					infer R2 extends ParserMonad,
					infer Inner,
					infer Env2 extends ExprParseEnv,
				]
				? NegateParsed<R2, Inner, Env2>
				: never
			: PeekToken<R1> extends TokenKey<"in">
				? ParseInListUntypedAfterInKw<R1, L, Env> extends [
						infer R2 extends ParserMonad,
						infer Inner,
						infer Env2 extends ExprParseEnv,
					]
					? NegateParsed<R2, Inner, Env2>
					: never
				: PeekToken<R1> extends TokenKey<"between">
					? ParseBetweenAfterL<R1, L, Env> extends [
							infer R2 extends ParserMonad,
							infer Inner,
							infer Env2 extends ExprParseEnv,
						]
						? NegateParsed<R2, Inner, Env2>
						: never
					: SkipFailedExpressionWithEnv<
							R1,
							FormatError<Errors["EXPECTED_LIKE_IN_OR_BETWEEN_AFTER_NOT"], []>,
							Env
						>
		: never

type NegateParsed<Tokens extends ParserMonad, Inner, Env extends ExprParseEnv> = Inner extends DbtyperErrorShape
	? SkipFailedExpressionWithEnv<Tokens, Inner, Env>
	: [Tokens, { kind: "not"; inner: Inner }, Env]

type ParseCaseExpectEndKeyword<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	ElseB extends ScalarExprAst | null,
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"end">
		? SkipToken<Tokens> extends infer Rend extends ParserMonad
			? Acc extends readonly []
				? SkipFailedExpressionWithEnv<Rend, FormatError<Errors["CASE_REQUIRES_AT_LEAST_ONE_WHEN"], []>, Env>
				: Disc extends null
					? [Rend, { kind: "case_searched"; arms: Acc; else_: ElseB }, Env]
					: [Rend, { kind: "case_simple"; discriminant: Disc; arms: Acc; else_: ElseB }, Env]
			: never
		: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_END_AFTER_CASE"], []>, Env>

type ParseCaseAfterOneArm<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, Acc, Disc, Env>
		: PeekToken<Tokens> extends TokenKey<"else">
			? SkipToken<Tokens> extends infer Re extends ParserMonad
				? ParseOrScalarUntyped<Re, Env> extends [
						infer Rel extends ParserMonad,
						infer Ea,
						infer EnvEa extends ExprParseEnv,
					]
					? Ea extends DbtyperErrorShape
						? SkipFailedExpressionWithEnv<Rel, Ea, EnvEa>
						: Ea extends ScalarExprAst
							? ParseCaseExpectEndKeyword<Rel, Acc, Ea, Disc, EnvEa>
							: never
					: never
				: never
			: PeekToken<Tokens> extends TokenKey<"end">
				? ParseCaseExpectEndKeyword<Tokens, Acc, null, Disc, Env>
				: SkipFailedExpressionWithEnv<Tokens, FormatError<Errors["EXPECTED_WHEN_ELSE_OR_END_IN_CASE"], []>, Env>

type ParseCaseWhenArmsThenElseEnd<
	Tokens extends ParserMonad,
	Acc extends readonly { when: ScalarExprAst; then: ScalarExprAst }[],
	Disc extends ScalarExprAst | null,
	Env extends ExprParseEnv,
> =
	PeekToken<Tokens> extends TokenKey<"when">
		? SkipToken<Tokens> extends infer Rw extends ParserMonad
			? ParseOrScalarUntyped<Rw, Env> extends [
					infer Rcond extends ParserMonad,
					infer Wast,
					infer EnvW extends ExprParseEnv,
				]
				? Wast extends DbtyperErrorShape
					? SkipFailedExpressionWithEnv<Rcond, Wast, EnvW>
					: Wast extends ScalarExprAst
						? PeekToken<Rcond> extends TokenKey<"then">
							? SkipToken<Rcond> extends infer Rt extends ParserMonad
								? ParseOrScalarUntyped<Rt, EnvW> extends [
										infer Rth extends ParserMonad,
										infer Thast,
										infer EnvTh extends ExprParseEnv,
									]
									? Thast extends DbtyperErrorShape
										? SkipFailedExpressionWithEnv<Rth, Thast, EnvTh>
										: Thast extends ScalarExprAst
											? ParseCaseAfterOneArm<
													Rth,
													readonly [...Acc, { when: Wast; then: Thast }],
													Disc,
													EnvTh
												>
											: never
									: never
								: never
							: SkipFailedExpressionWithEnv<
									Rcond,
									FormatError<Errors["EXPECTED_THEN_AFTER_CASE_WHEN"], []>,
									EnvW
								>
						: never
				: never
			: never
		: never

/** After `CASE` keyword: searched `CASE WHEN` or simple `CASE expr WHEN`. */
export type ParseCaseAfterCaseKw<Tokens extends ParserMonad, Env extends ExprParseEnv> =
	PeekToken<Tokens> extends TokenKey<"when">
		? ParseCaseWhenArmsThenElseEnd<Tokens, readonly [], null, Env>
		: ParseOrScalarUntyped<Tokens, Env> extends [
					infer Rd extends ParserMonad,
					infer Dast,
					infer EnvD extends ExprParseEnv,
			  ]
			? Dast extends DbtyperErrorShape
				? SkipFailedExpressionWithEnv<Rd, Dast, EnvD>
				: Dast extends ScalarExprAst
					? PeekToken<Rd> extends TokenKey<"when">
						? ParseCaseWhenArmsThenElseEnd<Rd, readonly [], Dast, EnvD>
						: SkipFailedExpressionWithEnv<
								Rd,
								FormatError<Errors["EXPECTED_WHEN_AFTER_CASE_EXPRESSION"], []>,
								EnvD
							>
					: never
			: never
