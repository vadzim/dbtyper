import type { DbDialectOnlyError } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlDataShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { ParseAlias } from "./parse-alias.ts"
import type { ParseTableRef, TableRefTarget } from "./parse-table-ref.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap, TableScopeColumns } from "./parser-scope.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"

import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ParseAndResolveReturningClause } from "./parse-select-returning.ts"

export type ParseDelete<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"from">
		? ParseDeleteAfterFrom<SkipToken<Tokens>, Db, Params>
		: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_FROM_AFTER_DELETE"], []>>

type ParseDeleteAfterFrom<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
> =
	ParseDeleteFromTableRef<Tokens, Db, {}, Params> extends [infer R extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
			? Third extends ParserRefErrorThirdSentinel
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends ScopeMap
					? PeekToken<R> extends TokenKey<"using">
						? DbDialectOnlyError<Db, "pg-delete-using"> extends infer OnlyErr extends DbtyperErrorShape
							? [R, Db, OnlyErr]
							: ParseDeleteUsingClause<SkipToken<R>, Db, Third, Params>
						: PeekToken<R> extends TokenKey<"where">
							? SkipToken<R> extends infer Rw0 extends ParserMonad
								? ParseWhereExpression<Rw0, Db, Third, Params> extends [
										infer Rw extends ParserMonad,
										infer We extends DbtyperErrorShape | null,
									]
									? We extends DbtyperErrorShape
										? [Rw, Db, We]
										: FinishDeleteStatement<Rw, Db, Third, Params>
									: never
								: never
							: FinishDeleteStatement<R, Db, Third, Params>
					: never
				: never
		: never

type ParseDeleteUsingClause<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseDeleteUsingTableRef<Tokens, Db, Scope, Params> extends [
		infer RUsing extends ParserMonad,
		infer UsingErr,
		infer UsingScope,
	]
		? UsingErr extends DbtyperErrorShape
			? [RUsing, Db, UsingErr]
			: UsingScope extends ScopeMap
				? MergeScope<Scope, UsingScope> extends infer MergedScope
					? MergedScope extends ScopeMap
						? PeekToken<RUsing> extends TokenKey<"where">
							? SkipToken<RUsing> extends infer Rw0 extends ParserMonad
								? ParseWhereExpression<Rw0, Db, MergedScope, Params> extends [
										infer Rw extends ParserMonad,
										infer We,
									]
									? We extends DbtyperErrorShape
										? [Rw, Db, We]
										: FinishDeleteStatement<Rw, Db, MergedScope, Params>
									: never
								: never
							: FinishDeleteStatement<RUsing, Db, MergedScope, Params>
						: never
					: never
				: never
		: never

type ParseDeleteUsingTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	_Scope extends ScopeMap,
	_Params extends ExpressionParamsShape,
> =
	ParseTableRef<Tokens, Db, "DELETE USING", null> extends [infer R extends ParserMonad, infer E, infer Target]
		? E extends null
			? Target extends TableRefTarget<
					infer Sch extends string,
					infer Tab extends string,
					infer Tbl extends JsqlDataShape
				>
				? ParseDeleteUsingTableAlias<R, Db, Sch, Tab, Tbl>
				: never
			: [R, E, Target]
		: never

type DeleteUsingAliasRow = {
	ends: TokenKey<"where" | "returning" | ";"> | TokenEot
	bare: "allowed"
	verb: ""
	afterAs: FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>
	bad: null
	tail: never
	tailError: null
}

type ParseDeleteUsingTableAlias<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
> =
	ParseAlias<Tokens, Db, DeleteUsingAliasRow> extends [infer R extends ParserMonad, infer E, infer Alias]
		? E extends null
			? [
					R,
					null,
					MergeScope<
						Record<
							Alias extends string ? Alias : Tab,
							{ schema: Sch; table: Tab; columns: TableScopeColumns<Tbl> }
						>,
						{}
					>,
				]
			: [R, E, Alias]
		: never

type FinishDeleteStatement<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap = {},
	Params extends ExpressionParamsShape = EmptyExpressionParams,
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
						? FinishDeleteSemicolon<Ra, DbA, Ret>
						: never
				: never
			: never
		: FinishDeleteSemicolon<Tokens, Db, null>

type FinishDeleteSemicolon<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Returning extends JsqlSelectStatementResult | null,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? [SkipToken<Tokens>, Db, Returning]
		: [Db, PeekToken<Tokens>] extends [{ cteDml: true }, TokenKey<")">]
			? [Tokens, Db, Returning] // PGT-26: the DELETE of a data-modifying CTE ends at `)`
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["DELETE"]>>

type ParseDeleteFromTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseTableRef<Tokens, Db, "DELETE FROM", "DELETE"> extends [infer R extends ParserMonad, infer E, infer Target]
		? E extends null
			? Target extends TableRefTarget<
					infer Sch extends string,
					infer Tab extends string,
					infer Tbl extends JsqlDataShape
				>
				? ParseDeleteAliasAfterTable<R, Db, Sch, Tab, Tbl, Scope, Params>
				: never
			: [R, E, Target]
		: never

type DeleteAliasRow = {
	ends: TokenKey<"using" | "where" | "returning" | ";"> | TokenEot
	bare: "dml"
	verb: "DELETE"
	afterAs: FormatError<Errors["EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM"], []>
	bad: FormatError<Errors["EXPECTED_ALIAS_OR_END_OF_TABLE_IN_DELETE_FROM"], []>
	tail: never
	tailError: null
}

/** `DELETE FROM t [[AS] alias]`: on SQLite the alias needs AS (`bareDmlAlias`). */
type ParseDeleteAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Scope extends ScopeMap,
	_Params extends ExpressionParamsShape,
> =
	ParseAlias<Tokens, Db, DeleteAliasRow> extends [infer R extends ParserMonad, infer E, infer Alias]
		? E extends null
			? [
					R,
					null,
					MergeScope<
						Record<
							Alias extends string ? Alias : Tab,
							{ schema: Sch; table: Tab; columns: TableScopeColumns<Tbl> }
						>,
						Scope
					>,
				]
			: [R, E, Alias]
		: never
