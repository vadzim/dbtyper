/**
 * The `col = expr, …` list of UPDATE SET and of INSERT … ON CONFLICT DO UPDATE SET: one parser for both (#146).
 * The list is parsed first (names checked against the table), the values are resolved after it by
 * {@link ResolveSetAssignments}: UPDATE resolves them once its FROM sources are known, DO UPDATE SET at the end of the
 * list. The two kinds differ only in the clause name, the error codes and the tokens that end the list ({@link SetKinds}).
 */
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken, ParserMonad } from "../lexer/parser-monad.ts"
import type { TokenEot, TokenIdent, AsIdent, TokenKey } from "../lexer/sql-lexer.ts"
import type { FormatError, FormatErrorOf, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { IsGeneratedColumn, ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { CollectParamProbes, IsParamProbeFound } from "../core/param-probe.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

/** The assignments of a SET list, in order: column name and the not yet resolved value. */
export type PendingAssignments = readonly (readonly [string, ScalarExprAst])[]

/** What the two SET clauses do not share: the clause name in messages, the error descriptions, the tokens after the list. */
type SetKinds = {
	update: {
		clause: "UPDATE SET"
		columnContext: "in UPDATE SET"
		noEquals: Errors["EXPECTED_EQUALS_AFTER_COLUMN_IN_UPDATE_SET"]
		noEnd: Errors["EXPECTED_COMMA_FROM_WHERE_OR_END_AFTER_UPDATE_ASSIGNMENT"]
		end: TokenKey<"from"> | TokenKey<"where"> | TokenKey<"returning"> | TokenKey<";"> | TokenEot
	}
	upsert: {
		clause: "ON CONFLICT DO UPDATE SET"
		columnContext: "in ON CONFLICT UPDATE"
		noEquals: Errors["EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE"]
		noEnd: Errors["EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET"]
		end: TokenKey<"where"> | TokenKey<"returning"> | TokenKey<"on"> | TokenKey<";"> | TokenEot
	}
}

type SetKind = keyof SetKinds

/**
 * Parses `col = expr {, col = expr}` after `SET`. Gives `[rest, Db, { cols, pending } | error]`; a column name may be a
 * keyword (`AsIdent`) in both clauses.
 */
export type ParseSetAssignments<
	Tokens extends ParserMonad,
	Kind extends SetKind,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[] = readonly [],
	Pending extends PendingAssignments = readonly [],
> =
	PeekToken<Tokens> extends infer TokCol
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? AsIdent<TokCol> extends TokenIdent<infer Col extends string>
				? JsqlDataGetColumnType<Tbl, Col> extends null
					? [R1, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Col, SetKinds[Kind]["clause"]]>]
					: IsGeneratedColumn<Tbl, Col> extends true
						? [
								R1,
								Db,
								FormatError<Errors["CANNOT_WRITE_GENERATED_COLUMN"], [Col, SetKinds[Kind]["clause"]]>,
							]
						: PeekToken<R1> extends TokenKey<"=">
							? SkipToken<R1> extends infer R2 extends ParserMonad
								? ParseExpressionAST<R2, { db: Db; params: Params; outerScope: Scope }> extends [
										infer R3 extends ParserMonad,
										infer Ast,
										infer _UpdatedEnv,
									]
									? Ast extends DbtyperErrorShape
										? [R3, Db, Ast]
										: Ast extends ScalarExprAst
											? PeekToken<R3> extends TokenKey<",">
												? ParseSetAssignments<
														SkipToken<R3>,
														Kind,
														Db,
														Scope,
														Params,
														Tbl,
														readonly [...Acc, Col],
														readonly [...Pending, readonly [Col, Ast]]
													>
												: PeekToken<R3> extends SetKinds[Kind]["end"]
													? [
															R3,
															Db,
															{
																cols: readonly [...Acc, Col]
																pending: readonly [...Pending, readonly [Col, Ast]]
															},
														]
													: [R3, Db, FormatErrorOf<SetKinds[Kind]["noEnd"], []>]
											: SkipFailedExpression<R3, never> extends [
														infer Rest extends ParserMonad,
														infer Err,
												  ]
												? [Rest, Db, Err]
												: never
									: never
								: never
							: SkipFailedStatement<R1, Db, FormatErrorOf<SetKinds[Kind]["noEquals"], []>>
				: SkipFailedStatement<
						R1,
						Db,
						FormatError<Errors["EXPECTED_COLUMN_NAME"], [SetKinds[Kind]["columnContext"]]>
					>
			: never
		: never

/**
 * Resolves the values of a SET list against `Scope` and checks each against its column; `true` or the first error.
 * CORE-6: the parameter probes of all assignments are collected, so one round binds them all.
 */
export type ResolveSetAssignments<
	Kind extends SetKind,
	Pending extends PendingAssignments,
	Tbl extends JsqlDataShape,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Found = null,
> = Pending extends readonly [readonly [infer Col extends string, infer Ast extends ScalarExprAst], ...infer Rest]
	? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
		? Resolved extends DbtyperErrorShape
			? IsParamProbeFound<Resolved> extends true
				? ResolveSetRest<Kind, Rest, Tbl, Db, Scope, Params, SetFoundWith<Found, Resolved>>
				: Found extends null
					? WithErrorClause<Resolved, SetKinds[Kind]["clause"]>
					: Found
			: Resolved extends SqlTypeShape
				? ValidateMutationValueForColumn<Tbl, Col, Resolved, Db, Ast> extends infer V0
					? V0 extends DbtyperErrorShape
						? IsParamProbeFound<V0> extends true
							? ResolveSetRest<Kind, Rest, Tbl, Db, Scope, Params, SetFoundWith<Found, V0>>
							: Found extends null
								? V0
								: Found
						: ResolveSetRest<Kind, Rest, Tbl, Db, Scope, Params, Found>
					: never
				: never
		: never
	: Found extends null
		? true
		: Found

type ResolveSetRest<
	Kind extends SetKind,
	Rest,
	Tbl extends JsqlDataShape,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Found,
> = Rest extends PendingAssignments
	? ResolveSetAssignments<Kind, Rest, Tbl, Db, Scope, Params, Found>
	: Found extends null
		? true
		: Found

type SetFoundWith<Found, Probe> = Found extends null ? Probe : CollectParamProbes<Found, Probe>
