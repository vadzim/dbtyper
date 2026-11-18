import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"

export type SelectGroupClauseMeta = {
	readonly have_explicit_group_by: boolean
	readonly has_having_clause: boolean
	readonly group_key_asts: readonly ScalarExprAst[]
}

type GroupByAstResolution<
	R1 extends ParserMonad,
	Ast extends ScalarExprAst,
	Acc extends readonly ScalarExprAst[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Rv
		? Rv extends DbtyperErrorShape
			? readonly [R1, { readonly error: WithErrorClause<Rv, "GROUP BY"> }]
			: Rv extends SqlTypeShape
				? PeekToken<R1> extends TokenKey<",">
					? ParseGroupByTermsAcc<SkipToken<R1>, Db, Scope, Params, readonly [...Acc, Ast]>
					: readonly [R1, { readonly keys: readonly [...Acc, Ast] }]
				: readonly [R1, { readonly error: never }]
		: never

type ParseGroupByTermsAcc<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Acc extends readonly ScalarExprAst[] = readonly [],
> =
	ParseExpressionAST<Tokens, { db: Db; params: Params; outerScope: Scope }> extends [
		infer R1 extends ParserMonad,
		infer Ast,
		infer _UpdatedEnv,
	]
		? Ast extends DbtyperErrorShape
			? readonly [R1, { readonly error: Ast }]
			: Ast extends ScalarExprAst
				? GroupByAstResolution<R1, Ast, Acc, Db, Scope, Params>
				: readonly [R1, { readonly error: never }]
		: never

/** After `GROUP BY expr[, …]`; optionally parse `HAVING`. */
type ParseOptionalHavingClauseAfterGroupTerms<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Gbs extends readonly ScalarExprAst[],
> =
	PeekToken<R2> extends TokenKey<"having">
		? SkipToken<R2> extends infer Rh extends ParserMonad
			? ParseWhereExpression<Rh, Db, Scope, Params, "HAVING"> extends [infer Rhw extends ParserMonad, infer He]
				? He extends DbtyperErrorShape
					? readonly [
							Rhw,
							He,
							{
								have_explicit_group_by: false
								has_having_clause: false
								group_key_asts: readonly []
							},
						]
					: readonly [
							Rhw,
							null,
							{
								have_explicit_group_by: true
								has_having_clause: true
								group_key_asts: Gbs
							},
						]
				: never
			: never
		: readonly [
				R2,
				null,
				{
					have_explicit_group_by: true
					has_having_clause: false
					group_key_asts: Gbs
				},
			]

type ParseOptionalHavingWithoutGroupClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"having">
		? SkipToken<Tokens> extends infer Rh extends ParserMonad
			? ParseWhereExpression<Rh, Db, Scope, Params, "HAVING"> extends [infer Rhw extends ParserMonad, infer He]
				? He extends DbtyperErrorShape
					? readonly [
							Rhw,
							He,
							{
								have_explicit_group_by: false
								has_having_clause: false
								group_key_asts: readonly []
							},
						]
					: readonly [
							Rhw,
							null,
							{
								have_explicit_group_by: false
								has_having_clause: true
								group_key_asts: readonly []
							},
						]
				: never
			: never
		: readonly [
				Tokens,
				null,
				{
					have_explicit_group_by: false
					has_having_clause: false
					group_key_asts: readonly []
				},
			]

type EmptyGroupClauseMetaPlain = {
	have_explicit_group_by: false
	has_having_clause: false
	group_key_asts: readonly []
}

type ParseGroupTailAfterTerms<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Outcome,
> = Outcome extends { readonly error: infer Ge extends DbtyperErrorShape }
	? readonly [R2, Ge, EmptyGroupClauseMetaPlain]
	: Outcome extends { readonly keys: infer Gbs extends readonly ScalarExprAst[] }
		? ParseOptionalHavingClauseAfterGroupTerms<R2, Db, Scope, Params, Gbs> extends readonly [
				infer R3 extends ParserMonad,
				infer He,
				infer Meta extends SelectGroupClauseMeta,
			]
			? readonly [R3, He, Meta]
			: never
		: never

export type ParseOptionalGroupHaving<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"group">
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? PeekToken<R0> extends TokenKey<"by">
				? SkipToken<R0> extends infer R1 extends ParserMonad
					? ParseGroupByTermsAcc<R1, Db, Scope, Params> extends readonly [
							infer R2 extends ParserMonad,
							infer Outcome,
						]
						? ParseGroupTailAfterTerms<R2, Db, Scope, Params, Outcome>
						: never
					: never
				: readonly [R0, FormatError<Errors["EXPECTED_BY_AFTER_GROUP"], []>, EmptyGroupClauseMetaPlain]
			: never
		: ParseOptionalHavingWithoutGroupClause<Tokens, Db, Scope, Params>
