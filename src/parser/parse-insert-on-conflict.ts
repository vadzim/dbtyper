import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { JsqlDatabaseShape, JsqlSelectStatementResult, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ScopeMap } from "./parser-scope.ts"
import type { IsGeneratedColumn, ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { CollectParamProbes, IsParamProbeFound } from "../core/param-probe.ts"
import type { ExpressionParamsShape, ParseExpressionAST, ScalarExprAst } from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { JsqlDataGetColumnType } from "../core/jsql-utils.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseInsertMaybeReturning } from "./parse-insert-returning.ts"
import type { InsertExcludedScope } from "./parse-insert-values.ts"

export type ParseInsertOptionalTail<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	UpsertCols extends readonly string[] | undefined,
	Returning extends JsqlSelectStatementResult | undefined,
> =
	PeekToken<Tokens> extends TokenKey<"on">
		? SkipToken<Tokens> extends infer ROn extends ParserMonad
			? PeekToken<ROn> extends TokenKey<"conflict">
				? ParseInsertOnConflictDoUpdate<SkipToken<ROn>, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: SkipFailedStatement<ROn, Db, FormatError<Errors["EXPECTED_CONFLICT_AFTER_ON_IN_INSERT"], []>>
			: never
		: ParseInsertMaybeReturning<Tokens, Db, Scope, Params, Tbl, Sch, Tab, Cols, UpsertCols, Returning>

type ParseInsertOnConflictDoUpdate<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<Tokens> extends infer T0
		? SkipToken<Tokens> extends infer R0 extends ParserMonad
			? T0 extends TokenKey<"(">
				? ParseInsertOnConflictAfterOpenParen<R0, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: T0 extends TokenKey<"on">
					? ParseInsertOnConstraint<R0, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: T0 extends TokenKey<"do">
						? // CORE-20: the conflict target may be omitted (`ON CONFLICT DO NOTHING`).
							ParseInsertOnConflictAfterDoKw<R0, Db, Scope, Params, Tbl, Sch, Tab, Cols>
						: SkipFailedStatement<
								R0,
								Db,
								FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT"], []>
							>
			: never
		: never

/**
 * PGT-25: `ON CONFLICT ON CONSTRAINT name DO …`. The name must be one of the table's named constraints, or a default
 * name PostgreSQL gives (`<table>_pkey`, `<table>_<column>_key`; those are not checked against the table's keys).
 */
type ParseInsertOnConstraint<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R0> extends TokenKey<"constraint">
		? SkipToken<R0> extends infer R1 extends ParserMonad
			? AsIdent<PeekToken<R1>> extends TokenIdent<infer CName extends string>
				? ConstraintExists<Tbl, Tab, CName> extends true
					? SkipToken<R1> extends infer R2 extends ParserMonad
						? PeekToken<R2> extends TokenKey<"do">
							? ParseInsertOnConflictAfterDoKw<SkipToken<R2>, Db, Scope, Params, Tbl, Sch, Tab, Cols>
							: SkipFailedStatement<
									R2,
									Db,
									FormatError<Errors["EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT"], []>
								>
						: never
					: SkipFailedStatement<R1, Db, FormatError<Errors["UNKNOWN_CONSTRAINT"], [CName, Tab]>>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CONSTRAINT_NAME_IN_CREATE_TABLE"], []>>
			: never
		: SkipFailedStatement<R0, Db, FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_ON_CONFLICT_IN_INSERT"], []>>

type ConstraintExists<Tbl extends JsqlDataShape, Tab extends string, Name extends string> = Name extends
	`${Tab}_pkey` | `${Tab}_${string}_key`
	? true
	: Tbl extends { constraints: { names: infer N extends string } }
		? Name extends N
			? true
			: false
		: false

type ParseInsertOnConflictAfterOpenParen<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	ParseInsertConflictColList<R0, Tbl, readonly []> extends [infer R1 extends ParserMonad, infer CRes]
		? CRes extends DbtyperErrorShape
			? [R1, Db, CRes]
			: CRes extends readonly string[]
				? ParseInsertOnConflictAfterConflictCloseParen<R1, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: never
		: never

type ParseInsertOnConflictAfterConflictCloseParen<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	AfterWhere extends boolean = false,
> = [AfterWhere, PeekToken<R2>] extends [false, TokenKey<"where">]
	? // SQLT-40: a partial-index conflict target `(cols) WHERE predicate`
		SkipToken<R2> extends infer Rw0 extends ParserMonad
		? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends ParserMonad, infer We]
			? We extends DbtyperErrorShape
				? [Rw, Db, We]
				: ParseInsertOnConflictAfterConflictCloseParen<Rw, Db, Scope, Params, Tbl, Sch, Tab, Cols, true>
			: never
		: never
	: PeekToken<R2> extends TokenKey<"do">
		? PeekToken<R2> extends infer TDo
			? SkipToken<R2> extends infer R3 extends ParserMonad
				? TDo extends TokenKey<"do">
					? ParseInsertOnConflictAfterDoKw<R3, Db, Scope, Params, Tbl, Sch, Tab, Cols>
					: SkipFailedExpression<
								R3,
								FormatError<Errors["EXPECTED_DO_AFTER_ON_CONFLICT_COLUMNS_IN_INSERT"], []>
						  > extends [infer Rest extends ParserMonad, infer Err]
						? [Rest, Db, Err]
						: never
				: never
			: never
		: SkipFailedStatement<R2, Db, FormatError<Errors["EXPECTED_DO_AFTER_ON_CONFLICT_COLUMN_LIST_IN_INSERT"], []>>

type ParseInsertOnConflictAfterDoKw<
	R3 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R3> extends infer TUp
		? SkipToken<R3> extends infer R4 extends ParserMonad
			? TUp extends TokenKey<"update">
				? ParseInsertOnConflictAfterUpdateKw<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols>
				: TUp extends TokenIdent<"nothing">
					? // CORE-20: nothing is assigned; RETURNING then yields the inserted rows only, same row type.
						ParseInsertOptionalTail<R4, Db, Scope, Params, Tbl, Sch, Tab, Cols, undefined, undefined>
					: SkipFailedStatement<
							R4,
							Db,
							FormatError<Errors["EXPECTED_UPDATE_AFTER_DO_IN_INSERT_ON_CONFLICT"], []>
						>
			: never
		: never

type ParseInsertOnConflictAfterUpdateKw<
	R4 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
> =
	PeekToken<R4> extends infer TSet
		? SkipToken<R4> extends infer R5 extends ParserMonad
			? TSet extends TokenKey<"set">
				? InsertExcludedScope<Sch, Tab, Tbl, Scope> extends infer UpsertScope extends ScopeMap
					? ParseInsertUpsertSetAssignments<R5, Db, UpsertScope, Params, Tbl, readonly []> extends [
							infer R6 extends ParserMonad,
							infer Db6 extends JsqlDatabaseShape,
							infer SetOut,
						]
						? SetOut extends DbtyperErrorShape
							? [R6, Db6, SetOut]
							: SetOut extends readonly string[]
								? ParseInsertAfterUpsertSet<
										R6,
										Db6,
										UpsertScope,
										Params,
										Tbl,
										Sch,
										Tab,
										Cols,
										SetOut,
										Scope
									>
								: never
						: never
					: never
				: SkipFailedStatement<
						R5,
						Db,
						FormatError<Errors["EXPECTED_SET_AFTER_UPDATE_IN_INSERT_ON_CONFLICT"], []>
					>
			: never
		: never

type ParseInsertConflictColList<Tokens extends ParserMonad, Tbl extends JsqlDataShape, Acc extends readonly string[]> =
	PeekToken<Tokens> extends TokenKey<")">
		? Acc extends readonly []
			? SkipFailedExpression<Tokens, FormatError<Errors["ON_CONFLICT_COLUMN_LIST_MUST_NOT_BE_EMPTY"], []>>
			: PeekToken<Tokens> extends TokenKey<")">
				? [SkipToken<Tokens>, Acc]
				: never
		: PeekToken<Tokens> extends infer Tok
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? Tok extends TokenIdent<infer C extends string>
					? JsqlDataGetColumnType<Tbl, C> extends null
						? SkipFailedExpression<R1, FormatError<Errors["UNKNOWN_COLUMN"], [C, "ON CONFLICT"]>>
						: PeekToken<R1> extends TokenKey<")">
							? SkipToken<R1> extends infer R2 extends ParserMonad
								? [R2, readonly [...Acc, C]]
								: never
							: PeekToken<R1> extends TokenKey<",">
								? ParseInsertConflictColList<SkipToken<R1>, Tbl, readonly [...Acc, C]>
								: SkipFailedExpression<
										R1,
										FormatError<
											Errors["EXPECTED_COMMA_OR_CLOSE_PAREN_IN_ON_CONFLICT_COLUMN_LIST"],
											[]
										>
									>
					: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in ON CONFLICT"]>>
				: never
			: never

type ParseInsertUpsertSetAssignments<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[],
	// CORE-6 (#143): the probes of all assignments, collected so one round binds them all
	Found = null,
> =
	PeekToken<Tokens> extends infer TokCol
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokCol extends TokenIdent<infer Col extends string>
				? JsqlDataGetColumnType<Tbl, Col> extends null
					? [R1, Db, FormatError<Errors["UNKNOWN_COLUMN"], [Col, "ON CONFLICT DO UPDATE SET"]>]
					: IsGeneratedColumn<Tbl, Col> extends true
						? [
								R1,
								Db,
								FormatError<
									Errors["CANNOT_WRITE_GENERATED_COLUMN"],
									[Col, "ON CONFLICT DO UPDATE SET"]
								>,
							]
						: PeekToken<R1> extends TokenKey<"=">
							? SkipToken<R1> extends infer R2 extends ParserMonad
								? ParseExpressionAST<R2, { db: Db; params: Params; outerScope: Scope }> extends [
										infer R3 extends ParserMonad,
										infer Ast,
										infer _UpdatedEnv,
									]
									? Ast extends DbtyperErrorShape
										? [R3, Db, Found extends null ? Ast : Found]
										: Ast extends ScalarExprAst
											? ResolveExpressionAST<Ast, Db, Scope, Params> extends infer Resolved
												? Resolved extends DbtyperErrorShape
													? IsParamProbeFound<Resolved> extends true
														? ParseInsertUpsertSetNext<
																R3,
																Db,
																Scope,
																Params,
																Tbl,
																readonly [...Acc, Col],
																UpsertFoundWith<Found, Resolved>
															>
														: [
																R3,
																Db,
																Found extends null
																	? WithErrorClause<
																			Resolved,
																			"ON CONFLICT DO UPDATE SET"
																		>
																	: Found,
															]
													: Resolved extends SqlTypeShape
														? ValidateMutationValueForColumn<
																Tbl,
																Col,
																Resolved,
																Db,
																Ast
															> extends infer V0
															? V0 extends DbtyperErrorShape
																? IsParamProbeFound<V0> extends true
																	? ParseInsertUpsertSetNext<
																			R3,
																			Db,
																			Scope,
																			Params,
																			Tbl,
																			readonly [...Acc, Col],
																			UpsertFoundWith<Found, V0>
																		>
																	: [R3, Db, Found extends null ? V0 : Found]
																: V0 extends true
																	? ParseInsertUpsertSetNext<
																			R3,
																			Db,
																			Scope,
																			Params,
																			Tbl,
																			readonly [...Acc, Col],
																			Found
																		>
																	: never
															: never
														: never
												: never
											: SkipFailedExpression<R3, never> extends [
														infer Rest extends ParserMonad,
														infer Err,
												  ]
												? [Rest, Db, Err]
												: never
									: never
								: never
							: SkipFailedStatement<
									R1,
									Db,
									FormatError<Errors["EXPECTED_EQUALS_AFTER_COLUMN_IN_ON_CONFLICT_UPDATE"], []>
								>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in ON CONFLICT UPDATE"]>>
			: never
		: never

type UpsertFoundWith<Found, Probe> = Found extends null ? Probe : CollectParamProbes<Found, Probe>

/** After an assignment of DO UPDATE SET: the next one, or the end (where the collected probes come out). */
type ParseInsertUpsertSetNext<
	R3 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Acc extends readonly string[],
	Found,
> =
	PeekToken<R3> extends TokenKey<",">
		? ParseInsertUpsertSetAssignments<SkipToken<R3>, Db, Scope, Params, Tbl, Acc, Found>
		: PeekToken<R3> extends TokenKey<"where"> | TokenKey<"returning"> | TokenKey<"on"> | TokenKey<";"> | TokenEot
			? [R3, Db, Found extends null ? Acc : Found]
			: [
					R3,
					Db,
					Found extends null
						? FormatError<Errors["EXPECTED_COMMA_WHERE_OR_END_AFTER_ON_CONFLICT_SET"], []>
						: Found,
				]
type ParseInsertAfterUpsertSet<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	UpsertScope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
	Cols extends readonly string[],
	SetCols extends readonly string[],
	BaseScope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"where">
		? SkipToken<Tokens> extends infer Rw0 extends ParserMonad
			? ParseWhereExpression<Rw0, Db, UpsertScope, Params> extends [infer Rw extends ParserMonad, infer We]
				? We extends DbtyperErrorShape
					? [Rw, Db, We]
					: ParseInsertOptionalTail<Rw, Db, BaseScope, Params, Tbl, Sch, Tab, Cols, SetCols, undefined>
				: never
			: never
		: ParseInsertOptionalTail<Tokens, Db, BaseScope, Params, Tbl, Sch, Tab, Cols, SetCols, undefined>
