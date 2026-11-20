import type { JsqlDatabaseShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { FromItemsOnly, ScopeEntry, ScopeMap, HiddenColumnsOf } from "./parser-scope.ts"
import type { SkipFailedExpression } from "./skip-statement.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"
import type { ParseWhereExpression } from "./parse-where-expression.ts"
import type { ParseFromTableRef } from "./parse-select-from.ts"
import type { JoinScopeOnly, TokenKeyOn } from "./parse-select.ts"
import type { ParseCteColumnNames } from "./parse-select-cte.ts"

export type ParseJoinChain<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends TokenKey<"inner">
		? ParseJoinAfterOptionalInner<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"left">
			? ParseJoinAfterLeft<SkipToken<Tokens>, Db, Scope, Params>
			: PeekToken<Tokens> extends TokenKey<"right">
				? ParseJoinAfterRight<SkipToken<Tokens>, Db, Scope, Params>
				: PeekToken<Tokens> extends TokenKey<"full">
					? ParseJoinAfterFull<SkipToken<Tokens>, Db, Scope, Params>
					: PeekToken<Tokens> extends TokenKey<"natural">
						? ParseJoinAfterNatural<SkipToken<Tokens>, Db, Scope, Params>
						: PeekToken<Tokens> extends TokenKey<"cross">
							? ParseJoinAfterCross<SkipToken<Tokens>, Db, Scope, Params>
							: PeekToken<Tokens> extends TokenKey<"join">
								? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner">
								: PeekToken<Tokens> extends TokenKey<",">
									? ParseCrossJoinItem<SkipToken<Tokens>, Db, Scope, Params, "table-function"> // SQLT-72
									: [Tokens, null, Scope]

type NaturalJoinKind<T> =
	T extends TokenKey<"inner">
		? "inner"
		: T extends TokenKey<"left">
			? "left"
			: T extends TokenKey<"right">
				? "right"
				: T extends TokenKey<"full">
					? "full"
					: "none"

/** CORE-9: `NATURAL [INNER | LEFT | RIGHT | FULL [OUTER]] JOIN t`, after `NATURAL`. */
type ParseJoinAfterNatural<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	NaturalJoinKind<PeekToken<Tokens>> extends infer K extends JoinKind | "none"
		? K extends "none"
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner", true>
			: SkipToken<Tokens> extends infer R1 extends ParserMonad
				? K extends JoinKind
					? PeekToken<R1> extends TokenKey<"outer">
						? SkipToken<R1> extends infer R2 extends ParserMonad
							? ParseJoinAfterJoinKw<R2, Db, Scope, Params, K, true>
							: never
						: ParseJoinAfterJoinKw<R1, Db, Scope, Params, K, true>
					: never
				: never
		: never

type ParseJoinAfterCross<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseCrossJoinItem<SkipToken<Tokens>, Db, Scope, Params>
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["CROSS"]>, ParserRefErrorThirdSentinel]

/**
 * The item of `CROSS JOIN`, or of a `,` (`Items` "table-function": only `json_each(…)` / `json_tree(…)` is joined
 * after a comma, like `CROSS JOIN`, SQLT-72), then the rest of the chain.
 */
type ParseCrossJoinItem<
	AfterJ extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Items extends "any" | "table-function" = "any",
> =
	ParseFromTableRef<AfterJ, Db, Scope, Params, Items> extends [infer R0 extends ParserMonad, infer Mid, infer Third]
		? Mid extends DbtyperErrorShape
			? Third extends ParserRefErrorThirdSentinel
				? [R0, Mid, ParserRefErrorThirdSentinel]
				: never
			: Mid extends null
				? [JoinScopeOnly<Third>] extends [never]
					? never
					: JoinScopeOnly<Third> extends ScopeMap
						? ParseJoinChain<R0, Db, JoinScopeOnly<Third>, Params>
						: never
				: never
		: never

type ParseJoinAfterOptionalInner<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "inner">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["INNER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterLeft<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterOptionalOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "left">
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["LEFT"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterRight<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterRightOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "right">
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["RIGHT"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterRightOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "right">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["RIGHT OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterFull<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"outer">
		? ParseJoinAfterFullOuter<SkipToken<Tokens>, Db, Scope, Params>
		: PeekToken<Tokens> extends TokenKey<"join">
			? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "full">
			: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterFullOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "full">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["FULL OUTER"]>, ParserRefErrorThirdSentinel]

type ParseJoinAfterOptionalOuter<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? ParseJoinAfterJoinKw<Tokens, Db, Scope, Params, "left">
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], ["LEFT OUTER"]>, ParserRefErrorThirdSentinel]

type JoinKind = "inner" | "left" | "right" | "full"

type NullableScopeEntry<E extends ScopeEntry> = {
	schema: E["schema"]
	table: E["table"]
	columns: {
		[C in keyof E["columns"]]: { type: E["columns"][C]["type"]; arg: E["columns"][C]["arg"]; nullable: true }
	}
	hidden?: HiddenColumnsOf<E>
}

/**
 * SEL-18: columns of the optional side of an outer join are nullable (right of LEFT, left of RIGHT, both of FULL).
 * The old side is the FROM items before the join: a CTE definition of the same name is no FROM item (#152).
 */
type MarkJoinNullable<Kind extends JoinKind, Old extends ScopeMap, New extends ScopeMap> = Kind extends "inner"
	? New
	: {
			[K in keyof New]: K extends keyof FromItemsOnly<Old>
				? Kind extends "right" | "full"
					? NullableScopeEntry<New[K]>
					: New[K]
				: Kind extends "left" | "full"
					? NullableScopeEntry<New[K]>
					: New[K]
		}

type ParseJoinAfterJoinKw<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
	Kind extends JoinKind,
	Natural extends boolean = false,
> =
	PeekToken<Tokens> extends TokenKey<"join">
		? SkipToken<Tokens> extends infer AfterJ extends ParserMonad
			? ParseFromTableRef<AfterJ, Db, Scope, Params> extends [
					infer R0 extends ParserMonad,
					infer Mid,
					infer Third,
				]
				? Mid extends DbtyperErrorShape
					? Third extends ParserRefErrorThirdSentinel
						? [R0, Mid, ParserRefErrorThirdSentinel]
						: never
					: Mid extends null
						? [JoinScopeOnly<Third>] extends [never]
							? never
							: JoinScopeOnly<Third> extends ScopeMap
								? Natural extends true
									? ParseJoinUsingChain<
											R0,
											Db,
											Scope,
											JoinScopeOnly<Third>,
											Kind,
											NaturalJoinColumns<Scope, JoinScopeOnly<Third>>,
											Params
										>
									: PeekToken<R0> extends TokenKey<"using">
										? ParseUsingColumnList<SkipToken<R0>> extends [
												infer R1 extends ParserMonad,
												infer Cols,
											]
											? Cols extends DbtyperErrorShape
												? [R1, Cols, ParserRefErrorThirdSentinel]
												: Cols extends readonly string[]
													? ParseJoinUsingChain<
															R1,
															Db,
															Scope,
															JoinScopeOnly<Third>,
															Kind,
															Cols[number],
															Params
														>
													: never
											: never
										: PeekToken<R0> extends TokenKeyOn
											? ParseJoinOn<
													R0,
													Db,
													MarkJoinNullable<Kind, Scope, JoinScopeOnly<Third>>,
													Params
												>
											: [
													R0,
													FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>,
													ParserRefErrorThirdSentinel,
												]
								: [
										R0,
										FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>,
										ParserRefErrorThirdSentinel,
									]
						: never
				: never
			: never
		: [Tokens, FormatError<Errors["EXPECTED_JOIN_KEYWORD"], [""]>, ParserRefErrorThirdSentinel]

/** `USING (a, b)` column list after `USING`. Returns `[Tokens, names | error]`. */
type ParseUsingColumnList<Tokens extends ParserMonad> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ParseCteColumnNames<SkipToken<Tokens>, []>
		: SkipFailedExpression<Tokens, FormatError<Errors["EXPECTED_ON_AFTER_JOIN_TABLE"], []>>

type NewJoinKey<Old extends ScopeMap, Merged extends ScopeMap> = Exclude<keyof Merged, keyof Old>

/** Scope keys (FROM items of the left side) that expose `Col` as a visible column. */
type LeftKeysWithColumn<Old extends ScopeMap, Col extends string> = {
	[K in keyof FromItemsOnly<Old>]: Col extends keyof Old[K]["columns"]
		? Col extends HiddenColumnsOf<Old[K]>
			? never
			: K
		: never
}[keyof FromItemsOnly<Old>]

/** CORE-9: the columns the new join table shares by name with the visible columns of the left side. */
type NaturalJoinColumns<Old extends ScopeMap, Merged extends ScopeMap> =
	NewJoinKey<Old, Merged> extends infer NK extends string
		? [NK] extends [never]
			? never
			: keyof Merged[NK]["columns"] extends infer C
				? C extends string
					? [LeftKeysWithColumn<Old, C>] extends [never]
						? never
						: C
					: never
				: never
		: never

/** Nullability of a merged USING column (CORE-9, SEL-18): FULL is nullable only if both sides are. */
type UsingColumnNullable<Kind extends JoinKind, L extends SqlTypeShape, R extends SqlTypeShape> = Kind extends "right"
	? R["nullable"]
	: Kind extends "full"
		? L["nullable"] extends true
			? R["nullable"]
			: false
		: L["nullable"]

type FirstUsingColumnError<
	Old extends ScopeMap,
	NK extends string,
	Merged extends ScopeMap,
	Cols extends string,
> = Cols extends string
	? [LeftKeysWithColumn<Old, Cols>] extends [never]
		? Cols
		: Cols extends keyof Merged[NK]["columns"]
			? never
			: Cols
	: never

/** The scope after `JOIN … USING (Cols)`: the left column carries the merged nullability, the right one is hidden. */
type ApplyJoinUsing<Kind extends JoinKind, Old extends ScopeMap, Merged extends ScopeMap, Cols extends string> =
	NewJoinKey<Old, Merged> extends infer NK extends string
		? [NK] extends [never]
			? MarkJoinNullable<Kind, Old, Merged>
			: [FirstUsingColumnError<Old, NK, Merged, Cols>] extends [never]
				? MarkJoinNullable<Kind, Old, Merged> extends infer Marked extends ScopeMap
					? {
							[K in keyof Marked]: K extends NK
								? {
										schema: Marked[K]["schema"]
										table: Marked[K]["table"]
										columns: Marked[K]["columns"]
										hidden: Cols | HiddenColumnsOf<Marked[K]>
									}
								: {
										schema: Marked[K]["schema"]
										table: Marked[K]["table"]
										columns: {
											[C in keyof Marked[K]["columns"]]: C extends Cols
												? [LeftKeysWithColumn<Old, C>] extends [K]
													? {
															type: Marked[K]["columns"][C]["type"]
															arg: Marked[K]["columns"][C]["arg"]
															nullable: UsingColumnNullable<
																Kind,
																Old[K & keyof Old]["columns"][C],
																Merged[NK]["columns"][C & keyof Merged[NK]["columns"]]
															>
														}
													: Marked[K]["columns"][C]
												: Marked[K]["columns"][C]
										}
										hidden?: HiddenColumnsOf<Marked[K]>
									}
						}
					: never
				: FormatError<Errors["JOIN_USING_COLUMN_NOT_FOUND"], [FirstUsingColumnError<Old, NK, Merged, Cols>]>
		: never

type ParseJoinUsingChain<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Old extends ScopeMap,
	Merged extends ScopeMap,
	Kind extends JoinKind,
	Cols extends string,
	Params extends ExpressionParamsShape,
> =
	ApplyJoinUsing<Kind, Old, Merged, Cols> extends infer Next
		? Next extends DbtyperErrorShape
			? [Tokens, Next, ParserRefErrorThirdSentinel]
			: Next extends ScopeMap
				? ParseJoinChain<Tokens, Db, Next, Params>
				: never
		: never

/** CORE-10: the ON condition is any boolean expression, checked like a WHERE condition. */
type ParseJoinOn<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	SkipToken<Tokens> extends infer R1 extends ParserMonad
		? ParseWhereExpression<R1, Db, Scope, Params, "JOIN ON"> extends [infer R2 extends ParserMonad, infer Err]
			? Err extends DbtyperErrorShape
				? [R2, Err, ParserRefErrorThirdSentinel]
				: ParseJoinChain<R2, Db, Scope, Params>
			: never
		: never
