import type { DialectFact } from "../core/dialect.ts"
import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { FormatError, Errors, DbtyperErrorShape } from "../dbtyper-error.ts"
import type { EmptyExpressionParams, ExpressionParamsShape, ScalarExprAst } from "./parse-expression.ts"
import type { ParseCallArgs } from "./parse-function-call.ts"
import type { ResolveExpressionAST } from "./resolve-expression.ts"
import type { ParseAlias } from "./parse-alias.ts"
import type { IndexNamesOf } from "./parse-index.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeEntry, ScopeMap, TableScopeColumns } from "./parser-scope.ts"
import type { WithErrorClause } from "./resolve-column-ref.ts"
import type { JsqlDbGetData, UnqualifiedSchema } from "../core/jsql-utils.ts"
import type { SqlTypeShape, NonNull } from "../core/sql-type-shape.ts"
import type { CteAsFromEntry, ParseParenDerivedSelect } from "./parse-select-subquery.ts"
import type { JoinScopeOnly } from "./parse-select.ts"
import type { ParseJoinChain } from "./parse-select-join.ts"

/**
 * One FROM item. `Items` "table-function": only a table-valued function call may come (the item after a `,`, SQLT-72);
 * anything else is the comma-list error (SEL "Not yet", SQLT-Q15), said at the comma, not at the first use of its table.
 */
export type ParseFromTableRef<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Items extends "any" | "table-function" = "any",
> =
	PeekToken<Tokens> extends infer Tok
		? SkipToken<Tokens> extends infer R1 extends ParserMonad
			? Tok extends TokenKey<"(">
				? Items extends "any"
					? ParseParenDerivedSelect<R1, Db, Scope, Params>
					: CommaListError<R1>
				: AsIdent<Tok> extends TokenIdent<infer A extends string>
					? A extends (Items extends "any" ? FromFunctionName : never) | TableFunctionName<Db>
						? PeekToken<R1> extends TokenKey<"(">
							? ParseFromFunction<R1, A, Db, Scope, Params>
							: Items extends "any"
								? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
								: CommaListError<R1>
						: Items extends "any"
							? ParseFromTableAfterLeadingIdent<R1, Db, A, Scope>
							: CommaListError<R1>
					: Items extends "any"
						? [
								R1,
								FormatError<Errors["EXPECTED_TABLE_NAME_OR_OPEN_PAREN_IN_FROM"], []>,
								ParserRefErrorThirdSentinel,
							]
						: CommaListError<R1>
			: never
		: never

type CommaListError<R extends ParserMonad> = [
	R,
	FormatError<Errors["EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE"], []>,
	ParserRefErrorThirdSentinel,
]

/** PGT-32: set-returning functions that may be a FROM item. */
type FromFunctionName = "unnest" | "generate_series"

/** SQLT-69: the table-valued functions of the chain's dialect (`tables` of its function catalog). */
type TableFunctionName<Db> = keyof DialectFact<Db, "functionCatalog">["tables"] & string

/**
 * PGT-32: `FROM unnest(array) [AS] alias[(col)]`, `FROM generate_series(a, b[, step]) [AS] alias[(col)]`: a one-column
 * relation of the element type. The call is parsed and resolved by the expression parser (in the scope of the items
 * before it, so a `JOIN unnest(t.tags)` sees `t`); the column is named by the column alias, else the alias, else
 * the function name.
 * SQLT-69…SQLT-71: a table-valued function (`json_each`, `json_tree`) is parsed the same way, as a call marked `from`
 * (the catalog checks its arguments and types its parameters); its columns are the catalog's `tables` row.
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
						Name extends TableFunctionName<Db>
							? { kind: "function_call"; name: Name; args: Args; from: true }
							: { kind: "function_call"; name: Name; args: Args },
						Db,
						Scope,
						Params
					> extends infer V
					? V extends DbtyperErrorShape
						? [R, WithErrorClause<V, "FROM">, ParserRefErrorThirdSentinel]
						: Name extends TableFunctionName<Db>
							? ParseTableFunctionAlias<R, Db, Name, Scope>
							: V extends SqlTypeShape
								? ParseFromFunctionAlias<R, Db, Name, NonNull<V>, Scope>
								: never
					: never
				: never
		: never

type FunctionAliasRow = {
	ends: FromItemEndToken
	bare: "allowed"
	verb: ""
	afterAs: FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>
	bad: FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>
	tail: never
	tailError: null
}

/** `[AS] alias [(column)]` after a FROM function; no alias keeps the function name. */
type ParseFromFunctionAlias<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Name extends string,
	Col extends SqlTypeShape,
	Scope extends ScopeMap,
> =
	ParseAlias<Tokens, Db, FunctionAliasRow> extends [infer R extends ParserMonad, infer E, infer Alias]
		? E extends null
			? Alias extends string
				? ParseFromFunctionAliasColumn<R, Alias, Col, Scope>
				: [R, null, MergeScope<Record<Name, FromFunctionEntry<Name, Col>>, Scope>]
			: [R, E, Alias]
		: never

/** `[AS] alias` after a table-valued function (SQLT-69); no alias keeps the function name. */
type ParseTableFunctionAlias<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Name extends TableFunctionName<Db>,
	Scope extends ScopeMap,
> =
	ParseAlias<Tokens, Db, FunctionAliasRow> extends [infer R extends ParserMonad, infer E, infer Alias]
		? E extends null
			? DialectFact<Db, "functionCatalog">["tables"][Name] extends infer Cols extends Record<string, SqlTypeShape>
				? [
						R,
						null,
						MergeScope<
							Record<
								Alias extends string ? Alias : Name,
								{ schema: "__subquery__"; table: "__subquery__"; columns: Cols }
							>,
							Scope
						>,
					]
				: never
			: [R, E, Alias]
		: never

/** The optional `(column)` after the alias of a FROM function. */
type ParseFromFunctionAliasColumn<
	Rn extends ParserMonad,
	Alias extends string,
	Col extends SqlTypeShape,
	Scope extends ScopeMap,
> =
	PeekToken<Rn> extends TokenKey<"(">
		? SkipToken<Rn> extends infer Rc extends ParserMonad
			? AsIdent<PeekToken<Rc>> extends TokenIdent<infer ColName extends string>
				? SkipToken<Rc> extends infer Rd extends ParserMonad
					? PeekToken<Rd> extends TokenKey<")">
						? [SkipToken<Rd>, null, MergeScope<Record<Alias, FromFunctionEntry<ColName, Col>>, Scope>]
						: [Rd, FormatError<Errors["EXPECTED_CLOSE_PAREN"], []>, ParserRefErrorThirdSentinel]
					: never
				: [Rc, FormatError<Errors["EXPECTED_COLUMN_NAME"], ["in the FROM alias"]>, ParserRefErrorThirdSentinel]
			: never
		: [Rn, null, MergeScope<Record<Alias, FromFunctionEntry<Alias, Col>>, Scope>]

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
							? ParseAliasAfterTable<R3, Db, A, B, Tbl, Scope>
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
			? ParseAliasAfterCTE<R1, Db, A, CteAsFromEntry<Scope[A]>, Scope>
			: JsqlDbGetData<Db, UnqualifiedSchema<Db, A>, A> extends infer Tbl extends JsqlDataShape
				? ParseAliasAfterTable<R1, Db, UnqualifiedSchema<Db, A>, A, Tbl, Scope>
				: [R1, FormatError<Errors["UNKNOWN_TABLE"], [A, "FROM"]>, ParserRefErrorThirdSentinel]

/** Tokens that end a FROM item without an alias (`,`: the join chain reads it, SQLT-72). */
type FromItemEndToken =
	| TokenKey<",">
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
	| TokenKey<"window">
	| TokenKey<"union">
	| TokenKey<"intersect">
	| TokenKey<"except">
	| TokenIdent<"with"> // `WITH [NO] DATA` after a materialized view's query (PGT-20)
	| TokenKey<")">
	| TokenKey<";">
	| TokenEot

type TableAliasRow = {
	ends: FromItemEndToken
	bare: "allowed"
	verb: ""
	afterAs: FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>
	bad: FormatError<Errors["EXPECTED_ALIAS_OR_JOIN_CLAUSE_AFTER_TABLE"], []>
	tail: never
	tailError: null
}

type CteAliasRow = {
	ends: FromItemEndToken
	bare: "allowed"
	verb: ""
	afterAs: FormatError<Errors["EXPECTED_ALIAS_NAME_AFTER_AS"], []>
	bad: FormatError<Errors["EXPECTED_ALIAS_AFTER_CTE"], []>
	tail: never
	tailError: null
}

type ParseAliasAfterCTE<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	CteName extends string,
	CteEntry extends ScopeEntry,
	Scope extends ScopeMap,
> =
	// SQLT-73: a CTE has no indexes, so `INDEXED BY` after it is 2221 (`NOT INDEXED` is fine)
	ParseAlias<Tokens, Db, CteAliasRow, { table: CteName; indexes: never }> extends [
		infer R extends ParserMonad,
		infer E,
		infer Alias,
	]
		? E extends null
			? [R, null, MergeScope<Record<Alias extends string ? Alias : CteName, CteEntry>, Scope>]
			: [R, E, Alias]
		: never

type ParseAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	Scope extends ScopeMap,
> =
	ParseAlias<Tokens, Db, TableAliasRow, { table: Tab; indexes: IndexNamesOf<Tbl> }> extends [
		infer R extends ParserMonad,
		infer E,
		infer Alias,
	]
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
