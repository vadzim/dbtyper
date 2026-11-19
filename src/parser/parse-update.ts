import type { WithErrorClause } from "./resolve-column-ref.ts"
import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlUpdateStatementResult,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent, AsIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap } from "./parser-scope.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseExpressionAST,
	ScalarExprAst,
} from "./parse-expression.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { JsqlDbGetColumnType } from "../core/jsql-utils.ts"
import type { IsGeneratedColumn, ValidateMutationValueForColumn } from "./parser-validate-mutation-value.ts"
import type { CollectParamProbes, IsParamProbeFound } from "../core/param-probe.ts"
import type { ParseAndResolveReturningClause } from "./parse-select-returning.ts"
import type { ParseFromJoinScope } from "./parse-select-from.ts"
import type { ConflictActionToken } from "./parse-insert.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseSetAssignments, ResolveSetAssignments, PendingAssignments } from "./parse-set-assignments.ts"
import type { UpdateTableContext, ParseUpdateFromTableRef } from "./parse-update-table.ts"

type ParseUpdateAfterSetKeyword<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Tbl extends JsqlDataShape,
	Sch extends string,
	Tab extends string,
> =
	PeekToken<Tokens> extends TokenKey<"set">
		? ParseSetAssignments<"update", SkipToken<Tokens>, Db, Scope, Params, Tbl> extends [
				infer R extends ParserMonad,
				infer Db2 extends JsqlDatabaseShape,
				infer Out,
			]
			? Out extends { cols: infer Cols extends readonly string[]; pending: infer Pending }
				? [R, Db2, { kind: "update"; table: Tab; schema: Sch; set_columns: Cols; pending: Pending }]
				: [R, Db2, Out]
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SET_IN_UPDATE"], []>>

type ParseUpdateFromClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
	Tbl extends JsqlDataShape,
> =
	ParseFromJoinScope<Tokens, Db, {}, Params> extends [infer RFrom extends ParserMonad, infer FromErr, infer FromScope]
		? FromErr extends DbtyperErrorShape
			? [RFrom, Db, FromErr]
			: FromScope extends ScopeMap
				? MergeScope<Scope, FromScope> extends infer MergedScope
					? MergedScope extends ScopeMap
						? PeekToken<RFrom> extends TokenKey<"where">
							? SkipToken<RFrom> extends infer Rw0 extends ParserMonad
								? ParseWhereExpression<Rw0, Db, MergedScope, Params> extends [
										infer Rw extends ParserMonad,
										infer We,
									]
									? We extends DbtyperErrorShape
										? [Rw, Db, We]
										: FinishUpdateReturning<Rw, Db, MergedScope, Params, Res, Tbl>
									: never
								: never
							: FinishUpdateReturning<RFrom, Db, MergedScope, Params, Res, Tbl>
						: never
					: never
				: never
		: never

type FinishUpdateStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
	Tbl extends JsqlDataShape,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? ParseUpdateFromClause<SkipToken<Tokens>, Db, Scope, Params, Res, Tbl>
		: PeekToken<Tokens> extends TokenKey<"where">
			? SkipToken<Tokens> extends infer Rw0 extends ParserMonad
				? ParseWhereExpression<Rw0, Db, Scope, Params> extends [infer Rw extends ParserMonad, infer We]
					? We extends DbtyperErrorShape
						? [Rw, Db, We]
						: FinishUpdateReturning<Rw, Db, Scope, Params, Res, Tbl>
					: never
				: never
			: FinishUpdateReturning<Tokens, Db, Scope, Params, Res, Tbl>

type FinishUpdateReturning<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
	Tbl extends JsqlDataShape,
> = Res extends { pending: infer Pending extends PendingAssignments }
	? ResolveSetAssignments<"update", Pending, Tbl, Db, Scope, Params> extends infer Checked
		? Checked extends DbtyperErrorShape
			? SkipFailedStatement<Tokens, Db, Checked>
			: FinishUpdateReturningResolved<
					Tokens,
					Db,
					Scope,
					Params,
					{ kind: "update"; table: Res["table"]; schema: Res["schema"]; set_columns: Res["set_columns"] }
				>
		: never
	: FinishUpdateReturningResolved<Tokens, Db, Scope, Params, Res>

type FinishUpdateReturningResolved<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Res extends JsqlUpdateStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<"returning">
		? SkipToken<Tokens> extends infer Rr extends ParserMonad
			? ParseAndResolveReturningClause<Rr, Db, Scope, Params> extends [
					infer Ra extends ParserMonad,
					infer DbA extends JsqlDatabaseShape,
					infer Ret,
				]
				? Ret extends DbtyperErrorShape
					? [Ra, DbA, Ret]
					: Ret extends JsqlSelectStatementResult
						? FinishUpdateSemicolon<Ra, DbA, Res, Ret>
						: never
				: never
			: never
		: FinishUpdateSemicolon<Tokens, Db, Res, null>

type FinishUpdateSemicolon<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Res extends JsqlUpdateStatementResult,
	Returning extends JsqlSelectStatementResult | null,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Returning extends null ? Res : Returning]
		: [Db, PeekToken<Tokens>] extends [{ cteDml: true }, TokenKey<")">]
			? [Tokens, Db, Returning extends null ? Res : Returning] // PGT-26: the UPDATE of a data-modifying CTE ends at `)`
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["UPDATE"]>>

type ParseUpdateAfterTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseUpdateFromTableRef<Tokens, Db> extends [infer R extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
			? Third extends ParserRefErrorThirdSentinel
				? SkipFailedStatement<R, Db, Mid>
				: never
			: Mid extends null
				? Third extends UpdateTableContext
					? ParseUpdateAfterSetKeyword<
							R,
							Db,
							Third["scope"],
							Params,
							Third["tbl"],
							Third["schema"],
							Third["table"]
						> extends [infer R2 extends ParserMonad, infer Db2 extends JsqlDatabaseShape, infer Out]
						? Out extends DbtyperErrorShape
							? [R2, Db2, Out]
							: Out extends JsqlUpdateStatementResult
								? FinishUpdateStatement<R2, Db2, Third["scope"], Params, Out, Third["tbl"]>
								: never
						: never
					: never
				: never
		: never

/** After `UPDATE`: `[OR action] table …` (SQLT-39). */
export type ParseUpdate<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"or">
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends ConflictActionToken
				? ParseUpdateAfterTableRef<SkipToken<R1>, Db, Params>
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CONFLICT_ACTION_AFTER_OR"], []>>
			: never
		: ParseUpdateAfterTableRef<Tokens, Db, Params>
