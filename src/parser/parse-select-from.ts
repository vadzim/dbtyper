import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type {
	EmptyExpressionParams,
	ExpressionParamsShape,
	ParseCallArgs,
	ResolveExpressionAST,
	ScalarExprAst,
} from "./parse-expression.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeEntry, ScopeMap, TableScopeColumns } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"
import type { CteAsFromEntry, ParseParenDerivedSelect } from "./parse-select-subquery.ts"
import type { JoinScopeOnly } from "./parse-select.ts"
import type { ParseJoinChain } from "./parse-select-join.ts"

export type ParseFromTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok extends TokenKey<"(">
				? ParseParenDerivedSelect<R1, Db, Scope, Params>
				: AsIdent<Tok> extends TokenIdent<infer A extends string>
					? A extends FromFunctionName
						? PeekToken<R1> extends TokenKey<"(">
							? ParseFromFunction<R1, A, Db, Scope, Params>
							: ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
						: ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
					: [
							R1,
							FormatError<Errors["EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM"], []>,
							ParserRefErrorThirdSentinel,
						]
			: never
		: never

/** PGT-32: set-returning functions that may be a FROM item. */
type FromFunctionName = "unnest" | "generate_series"

/**
 * PGT-32: `FROM unnest(array) [AS] alias[(col)]`, `FROM generate_series(a, b[, step]) [AS] alias[(col)]`: a one-column
 * relation of the element type. The call is parsed and resolved by the expression parser (in the scope of the items
 * before it, so a `JOIN unnest(t.tags)` sees `t`); the column is named by the column alias, else the alias, else
 * the function name.
 */
type ParseFromFunction<
	AtParen extends ParserMonad,
	Name extends string,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape,
> =
	ParseCallArgs<SkipToken<AtParen>, readonly [Name], { db: Db; params: Params; outerScope: Scope }> extends [
		infer R extends ParserMonad,
		infer Args,
		infer _Env,
	]
		? Args extends DbtyperErrorShape
			? [R, Args, ParserRefErrorThirdSentinel]
			: Args extends readonly (ScalarExprAst | { kind: "star" })[]
				? ResolveExpressionAST<
						{ kind: "function_call"; name: Name; args: Args },
						Db,
						Scope,
						Params
					> extends infer V
					? V extends DbtyperErrorShape
						? [R, WithErrorClause<V, "FROM">, ParserRefErrorThirdSentinel]
						: V extends SqlTypeShape
							? ParseFromFunctionAlias<R, Name, NonNull<V>, Scope>
							: never
					: never
				: never
		: never

/** `[AS] alias [(column)]` after a FROM function; no alias keeps the function name. */
type ParseFromFunctionAlias<
	Tokens extends ParserMonad,
	Name extends string,
	Col extends SqlTypeShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends FromItemEndToken
		? [Tokens, null, MergeScope<Record<Name, FromFunctionEntry<Name, Col>>, Scope>]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ra extends ParserMonad
				? ParseFromFunctionAliasName<Ra, Col, Scope>
				: never
			: ParseFromFunctionAliasName<Tokens, Col, Scope>

type ParseFromFunctionAliasName<Tokens extends ParserMonad, Col extends SqlTypeShape, Scope extends ScopeMap> =
	AsIdent<PeekToken<Tokens>> extends TokenIdent<infer Alias extends string>
		? SkipToken<Tokens> extends infer Rn extends ParserMonad
			? PeekToken<Rn> extends TokenKey<"(">
				? SkipToken<Rn> extends infer Rc extends ParserMonad
					? AsIdent<PeekToken<Rc>> extends TokenIdent<infer ColName extends string>
						? SkipToken<Rc> extends infer Rd extends ParserMonad
							? PeekToken<Rd> extends TokenKey<")">
								? [
										SkipToken<Rd>,
										null,
										MergeScope<Record<Alias, FromFunctionEntry<ColName, Col>>, Scope>,
									]
								: [Rd, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, ParserRefErrorThirdSentinel]
							: never
						: [
								Rc,
								FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in the FROM alias"]>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: [Rn, null, MergeScope<Record<Alias, FromFunctionEntry<Alias, Col>>, Scope>]
			: never
		: [Tokens, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]

type FromFunctionEntry<ColName extends string, Col extends SqlTypeShape> = {
	schema: "__subquery__"
	table: "__subquery__"
	columns: Record<ColName, Col>
}

/** A FROM clause with joins as `[rest, error | null, scope]`; also the source list of `UPDATE … FROM` (SQLT-42). */
export type ParseFromJoinScope<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseFromTableRef<Tokens, Db, Scope, Params> extends [infer R0 extends ParserMonad, infer Mid, infer Third]
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

type ParseFromTableAfterLeadingIdent<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	A extends string,
	Scope extends ScopeMap,
> =
	PeekToken<R1> extends TokenKey<".">
		? SkipToken<R1> extends infer R2 extends ParserMonad
			? PeekToken<R2> extends infer TokB
				? SkipToken<R2> extends infer R3 extends ParserMonad
					? AsIdent<TokB> extends TokenIdent<infer B extends string>
						? JsqlDbGetData<Db, A, B> extends infer Tbl extends JsqlDataShape
							? ParseAliasAfterTable<R3, A, B, Tbl, Scope>
							: [
									R3,
									FormatError<Errors["UNKNOWN_SCHEMA_OR_TABLE"], [A, "FROM"]>,
									ParserRefErrorThirdSentinel,
								]
						: [
								R3,
								FormatError<Errors["EXPECTED_TABLE_NAME"], ["after `.` in FROM"]>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: never
			: never
		: A extends keyof Scope
			? ParseAliasAfterCTE<R1, A, CteAsFromEntry<Scope[A]>, Scope>
			: JsqlDbGetData<Db, UnqualifiedSchema<Db, A>, A> extends infer Tbl extends JsqlDataShape
				? ParseAliasAfterTable<R1, UnqualifiedSchema<Db, A>, A, Tbl, Scope>
				: [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "FROM"]>, ParserRefErrorThirdSentinel]

/** Tokens that end a FROM item without an alias. */
type FromItemEndToken =
	| TokenKey<"returning">
	| TokenKey<"inner">
	| TokenKey<"left">
	| TokenKey<"right">
	| TokenKey<"full">
	| TokenKey<"cross">
	| TokenKey<"natural">
	| TokenKey<"join">
	| TokenKey<"on">
	| TokenKey<"using">
	| TokenKey<"where">
	| TokenKey<"order">
	| TokenKey<"limit">
	| TokenKey<"offset">
	| TokenKey<"fetch">
	| TokenKey<"group">
	| TokenKey<"having">
	| TokenKey<"union">
	| TokenKey<"intersect">
	| TokenKey<"except">
	| TokenIdent<"with"> // `WITH [NO] DATA` after a materialized view's query (PGT-20)
	| TokenKey<")">
	| TokenKey<";">
	| TokenEot

type ParseAliasAfterCTE<
	Tokens extends ParserMonad,
	CteName extends string,
	CteEntry extends ScopeEntry,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends FromItemEndToken
		? [Tokens, null, MergeScope<Record<CteName, CteEntry>, Scope>]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
						? AsIdent<TokName> extends TokenIdent<infer Alias extends string>
							? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
							: [Ra, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends ParserMonad
					? TokAlias extends TokenIdent<infer Alias extends string>
						? [Ra, null, MergeScope<Record<Alias, CteEntry>, Scope>]
						: [Ra, FormatError<Errors["EXPECTED_ALIAS_AFTER_CTE"], []>, ParserRefErrorThirdSentinel]
					: never
				: never

type ParseAliasAfterTable<
	Tokens extends ParserMonad,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends FromItemEndToken
		? [
				Tokens,
				null,
				MergeScope<
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: TableScopeColumns<Tbl>
						}
					>,
					Scope
				>,
			]
		: PeekToken<Tokens> extends TokenKey<"as">
			? SkipToken<Tokens> extends infer Ras0 extends ParserMonad
				? PeekToken<Ras0> extends infer TokName
					? SkipToken<Ras0> extends infer Ra extends ParserMonad
						? AsIdent<TokName> extends TokenIdent<infer Alias extends string>
							? [
									Ra,
									null,
									MergeScope<
										Record<
											Alias,
											{
												schema: Sch
												table: Tab
												columns: TableScopeColumns<Tbl>
											}
										>,
										Scope
									>,
								]
							: [Ra, FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>, ParserRefErrorThirdSentinel]
						: never
					: never
				: never
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends ParserMonad
					? TokAlias extends TokenIdent<infer Alias extends string>
						? [
								Ra,
								null,
								MergeScope<
									Record<
										Alias,
										{
											schema: Sch
											table: Tab
											columns: TableScopeColumns<Tbl>
										}
									>,
									Scope
								>,
							]
						: [
								Ra,
								FormatError<Errors["EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE"], []>,
								ParserRefErrorThirdSentinel,
							]
					: never
				: never
