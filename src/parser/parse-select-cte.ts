import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { ExpressionParamsShape } from "./parse-expression.ts"
import type { MergeScope, ScopeEntry, ScopeMap } from "./parser-scope.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseInsert } from "./parse-insert.ts"
import type { ParseUpdate } from "./parse-update.ts"
import type { ParseDelete } from "./parse-delete.ts"
import type { MergeSetOperation, RenameOutputColumns } from "./set-operation-types.ts"
import type {
	ConsumeClosingParen,
	ParseParenEnclosedSelect,
	SelectResultToCteScopeEntry,
} from "./parse-select-subquery.ts"
import type {
	ParseCompoundTrailing,
	ParseSelectArm,
	ParseSelectCompound,
	ParseSetOperationRightArm,
} from "./parse-select.ts"

type ParseSelectWithCtesAfterSubquery<
	R4 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	CteName extends string,
	SubOut extends JsqlSelectStatementResult,
	OuterScope extends ScopeMap,
	CteBase extends ScopeMap,
	Recursive extends boolean,
> =
	SelectResultToCteScopeEntry<Db, SubOut> extends infer Entry extends ScopeEntry
		? MergeScope<Record<CteName, Entry>, Acc> extends infer NextAcc
			? NextAcc extends ScopeMap
				? PeekToken<R4> extends TokenKey<",">
					? ParseSelectWithCtes<SkipToken<R4>, Db, Params, NextAcc, OuterScope, CteBase, Recursive>
					: PeekToken<R4> extends TokenKey<"select">
						? ParseSelectCompound<SkipToken<R4>, Db, Params, MergeScope<NextAcc, CteBase>, OuterScope>
						: SkipFailedStatement<R4, Db, FormatError<Errors["EXPECTED_SELECT_AFTER_WITH"], []>>
				: never
			: never
		: never

/** Optional `(col, …)` after a CTE name. Returns `[Tokens, names | error]`. */
export type ParseCteColumnList<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"("> ? ParseCteColumnNames<SkipToken<Tokens>, []> : [Tokens, null]

export type ParseCteColumnNames<Tokens extends ParserMonad, Acc extends readonly string[]> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer N0 extends string>
		? // SQLite (SQLT-67): a listed name is an output name, kept as written like an alias
			(PeekToken<Tokens> extends { written: infer W extends string } ? W : N0) extends infer N extends string
			? SkipToken<Tokens> extends infer R1 extends ParserMonad
				? PeekToken<R1> extends TokenKey<",">
					? ParseCteColumnNames<SkipToken<R1>, [...Acc, N]>
					: PeekToken<R1> extends TokenKey<")">
						? [SkipToken<R1>, [...Acc, N]]
						: SkipFailedExpression<R1, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>
				: never
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>

/** Apply the CTE column list (names by position); no list keeps the query's own names. */
export type ApplyCteColumnList<
	Res extends JsqlSelectStatementResult,
	Cols,
	Name extends string = "",
> = Cols extends readonly string[] ? RenameOutputColumns<Res, Cols, Name> : Res

/**
 * The parenthesised body of a CTE after `(`. A `WITH RECURSIVE` body may be `non-recursive UNION [ALL] recursive`:
 * the recursive arm sees the CTE under its own name with the non-recursive arm's columns (CORE-12).
 * Returns `[Tokens, Result | error]` after the closing `)`.
 */
type ParseCteBody<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	CteName extends string,
	Cols,
	Visible extends ScopeMap,
	Recursive extends boolean,
> = Recursive extends true
	? PeekToken<Tokens> extends TokenKey<"select">
		? ParseSelectArm<SkipToken<Tokens>, Db, Params, Visible, {}> extends [
				infer Ra extends ParserMonad,
				infer _Db2,
				infer Res1,
			]
			? Res1 extends DbtyperErrorShape
				? SkipFailedExpression<Ra, Res1>
				: Res1 extends JsqlSelectStatementResult
					? ApplyCteColumnList<Res1, Cols, CteName> extends infer Named
						? Named extends DbtyperErrorShape
							? SkipFailedExpression<Ra, Named>
							: Named extends JsqlSelectStatementResult
								? PeekToken<Ra> extends TokenKey<"union">
									? ParseSetOperationRightArm<
											SkipToken<Ra>,
											Db,
											Params,
											MergeScope<
												Record<CteName, SelectResultToCteScopeEntry<Db, Named>>,
												Visible
											>,
											{}
										> extends [infer Rb extends ParserMonad, infer Res2]
										? Res2 extends DbtyperErrorShape
											? SkipFailedExpression<Rb, Res2>
											: Res2 extends JsqlSelectStatementResult
												? MergeSetOperation<Named, Res2, "UNION"> extends infer Merged
													? Merged extends DbtyperErrorShape
														? SkipFailedExpression<Rb, Merged>
														: ParseCompoundTrailing<Rb, Db, Merged, Params> extends [
																	infer Rc extends ParserMonad,
																	infer _Db3,
																	infer Mt,
															  ]
															? Mt extends DbtyperErrorShape
																? SkipFailedExpression<Rc, Mt>
																: ConsumeClosingParen<Rc, Mt>
															: never
													: never
												: never
										: never
									: ConsumeClosingParen<Ra, Named>
								: never
						: never
					: never
			: never
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>
	: PeekToken<Tokens> extends TokenKey<"insert" | "update" | "delete">
		? DialectFact<Db, "dmlInCte"> extends true
			? ParseCteDml<Tokens, Db, Params, Cols, CteName>
			: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_SELECT_IN_SUBQUERY"], []>>
		: ParseParenEnclosedSelect<Tokens, Db, Params, {}, Visible> extends [infer R4 extends ParserMonad, infer SubOut]
			? SubOut extends JsqlSelectStatementResult
				? ApplyCteColumnList<SubOut, Cols, CteName> extends infer Named
					? Named extends DbtyperErrorShape
						? SkipFailedExpression<R4, Named>
						: [R4, Named]
					: never
				: [R4, SubOut]
			: never

/**
 * PGT-26: `WITH x AS (INSERT | UPDATE | DELETE … [RETURNING …])`: the statement is parsed by its own parser (it ends
 * at `)` instead of `;`); the CTE has the RETURNING columns, or none. Returns `[Tokens, Result | error]` after `)`.
 */
type ParseCteDml<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Cols,
	CteName extends string,
> =
	PeekToken<Tokens> extends TokenKey<"insert">
		? ParseInsert<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
				infer R1 extends ParserMonad,
				infer _Db2,
				infer Res,
			]
			? FinishCteDml<R1, Res, Cols, CteName>
			: never
		: PeekToken<Tokens> extends TokenKey<"update">
			? ParseUpdate<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
					infer R1 extends ParserMonad,
					infer _Db2,
					infer Res,
				]
				? FinishCteDml<R1, Res, Cols, CteName>
				: never
			: ParseDelete<SkipToken<Tokens>, Db & { cteDml: true }, Params> extends [
						infer R1 extends ParserMonad,
						infer _Db2,
						infer Res,
				  ]
				? FinishCteDml<R1, Res, Cols, CteName>
				: never

/** The RETURNING columns of the data-modifying CTE are its columns (none without RETURNING); then `)`. */
type FinishCteDml<R1 extends ParserMonad, Res, Cols, CteName extends string> = Res extends DbtyperErrorShape
	? SkipFailedExpression<R1, Res>
	: Res extends { returning: infer Ret }
		? ApplyCteColumnList<
				{ kind: "select"; returning: Ret extends Record<string, SqlTypeShape> ? Ret : {} },
				Cols,
				CteName
			> extends infer Named
			? Named extends DbtyperErrorShape
				? SkipFailedExpression<R1, Named>
				: ConsumeClosingParen<R1, Named>
			: never
		: never

export type ParseSelectWithCtes<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Acc extends ScopeMap,
	OuterScope extends ScopeMap,
	CteBase extends ScopeMap,
	Recursive extends boolean,
> =
	PeekToken<Tokens> extends infer TokCteName
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? TokCteName extends TokenIdent<infer CteName extends string>
				? CteName extends keyof Acc
					? [R1, Db, FormatError<Errors["DUPLICATE_WITH_CLAUSE_NAME"], []>]
					: ParseCteColumnList<R1> extends [infer R1b extends ParserMonad, infer Cols]
						? Cols extends DbtyperErrorShape
							? [R1b, Db, Cols]
							: PeekToken<R1b> extends TokenKey<"as">
								? SkipToken<R1b> extends infer R2 extends ParserMonad
									? PeekToken<R2> extends TokenKey<"(">
										? SkipToken<R2> extends infer R3 extends ParserMonad
											? ParseCteBody<
													R3,
													Db,
													Params,
													CteName,
													Cols,
													MergeScope<Acc, CteBase>,
													Recursive
												> extends [infer R4 extends ParserMonad, infer SubOut]
												? SubOut extends DbtyperErrorShape
													? [R4, Db, SubOut]
													: SubOut extends JsqlSelectStatementResult
														? ParseSelectWithCtesAfterSubquery<
																R4,
																Db,
																Params,
																Acc,
																CteName,
																SubOut,
																OuterScope,
																CteBase,
																Recursive
															>
														: never
												: never
											: never
										: SkipFailedExpression<
													R2,
													FormatError<Errors["EXPECTED_OPEN_PAREN_AFTER_AS_IN_WITH"], []>
											  > extends [infer Rest extends ParserMonad, infer Err]
											? [Rest, Db, Err]
											: never
									: never
								: never
						: never
				: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_CTE_NAME_IN_WITH"], []>>
			: never
		: never
