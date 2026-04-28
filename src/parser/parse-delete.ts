import type { JsqlDatabaseShape, JsqlTableShape } from "../../core/jsql-shapes.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokenNumber,
	TokenParam,
	TokenString,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { HasAmbiguousUnqualifiedColumn, ScopeKeysWithColumn } from "./scope-unqualified-helpers.ts"
import type { SkipBracketedUntil } from "./skip-statement.ts"

export type ParseDelete<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenKey<"from">
		? ParseDeleteAfterFrom<SkipToken<Tokens>, Db>
		: [Tokens, Db, SqlParserError<"Expected FROM after DELETE">]

type ParseDeleteAfterFrom<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ParseDeleteFromTableRef<Tokens, Db, {}> extends [infer R extends TokensList, infer Mid, infer Third]
		? Mid extends SqlParserError<string>
			? Third extends never
				? [R, Db, Mid]
				: never
			: Mid extends null
				? Third extends ScopeMap
					? PeekToken<R> extends TokenKey<"where">
						? ParseDeleteWhereClause<SkipToken<R>, Db, Third> extends [
								infer Rw extends TokensList,
								infer We extends SqlParserError<string> | null,
							]
							? We extends SqlParserError<string>
								? [Rw, Db, We]
								: FinishDeleteStatement<Rw, Db>
							: never
						: FinishDeleteStatement<R, Db>
					: never
				: never
		: never

type FinishDeleteStatement<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterSemi extends TokensList, infer Tok]
		? Tok extends TokenKey<";"> | TokenEot
			? [AfterSemi, Db, null]
			: [AfterSemi, Db, SqlParserError<"Expected `;` after DELETE">]
		: never

/** --- FROM (single table, same resolution as SELECT) --- */

type ScopeEntry = {
	schema: string
	table: string
	columns: JsqlTableShape["columns"]
	column_sql_types: Record<string, string>
}

type ScopeMap = { readonly [alias: string]: ScopeEntry }

type MergeScope<A extends ScopeMap, B extends ScopeMap> = A & B

type ResolveTableShape<
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
> = Sch extends keyof Db["schemas"]
	? Tab extends keyof Db["schemas"][Sch]["tables"]
		? Db["schemas"][Sch]["tables"][Tab]
		: never
	: never

type EmptySqlTypes = Record<string, string>

type SqlTypesOf<Tbl extends JsqlTableShape> = Tbl["column_sql_types"] extends infer S
	? S extends Record<string, string>
		? S
		: EmptySqlTypes
	: EmptySqlTypes

type ParseDeleteFromTableRef<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer Tok]
		? Tok extends TokenIdent<infer A extends string>
			? PeekToken<R1> extends TokenKey<".">
				? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
					? ReadToken<R2> extends [infer R3 extends TokensList, infer TokB]
						? TokB extends TokenIdent<infer B extends string>
							? ResolveTableShape<Db, A, B> extends infer TblTry
								? [TblTry] extends [never]
									? [R3, SqlParserError<"Unknown schema or table in DELETE FROM">, never]
									: TblTry extends JsqlTableShape
										? ParseDeleteAliasAfterTable<R3, Db, A, B, TblTry, Scope>
										: [R3, SqlParserError<"Unknown schema or table in DELETE FROM">, never]
								: never
							: [R3, SqlParserError<"Expected table name after `.` in DELETE FROM">, never]
						: never
					: never
				: ResolveTableShape<Db, Db["defaultSchema"], A> extends infer TblTry
					? [TblTry] extends [never]
						? [R1, SqlParserError<"Unknown table in DELETE FROM">, never]
						: TblTry extends JsqlTableShape
							? ParseDeleteAliasAfterTable<R1, Db, Db["defaultSchema"], A, TblTry, Scope>
							: [R1, SqlParserError<"Unknown table in DELETE FROM">, never]
					: never
			: [R1, SqlParserError<"Expected table name in DELETE FROM">, never]
		: never

type ParseDeleteAliasAfterTable<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlTableShape,
	Scope extends ScopeMap,
> =
	PeekToken<Tokens> extends TokenKey<"where"> | TokenKey<";"> | TokenEot
		? [
				Tokens,
				null,
				MergeScope<
					Scope,
					Record<
						Tab,
						{
							schema: Sch
							table: Tab
							columns: Tbl["columns"]
							column_sql_types: SqlTypesOf<Tbl>
						}
					>
				>,
			]
		: ReadToken<Tokens> extends [infer Ra extends TokensList, infer TokAlias]
			? TokAlias extends TokenIdent<infer Alias extends string>
				? [
						Ra,
						null,
						MergeScope<
							Scope,
							Record<
								Alias,
								{
									schema: Sch
									table: Tab
									columns: Tbl["columns"]
									column_sql_types: SqlTypesOf<Tbl>
								}
							>
						>,
					]
				: [Ra, SqlParserError<"Expected alias or end of table in DELETE FROM">, never]
			: never

/** --- WHERE (column reference validation only) --- */

type MergeErr<A, B> = A extends SqlParserError<string> ? A : B extends SqlParserError<string> ? B : null

type ValidateCol<Scope extends ScopeMap, Alias extends string, Col extends string> = Alias extends keyof Scope
	? Col extends keyof Scope[Alias]["columns"]
		? true
		: false
	: false

type GetColMeta3Delete<Db extends JsqlDatabaseShape, Sch extends string, Tab extends string, Col extends string> =
	ResolveTableShape<Db, Sch, Tab> extends infer Tbl extends JsqlTableShape
		? Col extends keyof Tbl["columns"]
			? null
			: SqlParserError<"Unknown column (schema.table.column) in DELETE WHERE">
		: SqlParserError<"Unknown schema or table in DELETE WHERE">

type ValidateDeleteColumnParts<
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
	Parts extends readonly [string] | readonly [string, string] | readonly [string, string, string],
> = Parts extends readonly [infer S extends string, infer T extends string, infer C extends string]
	? GetColMeta3Delete<Db, S, T, C>
	: Parts extends readonly [infer A extends string, infer C extends string]
		? ValidateCol<Scope, A, C> extends true
			? null
			: SqlParserError<"Unknown qualified column in DELETE WHERE">
		: Parts extends readonly [infer C extends string]
			? true extends HasAmbiguousUnqualifiedColumn<Scope, C>
				? SqlParserError<"Ambiguous unqualified column in DELETE WHERE">
				: ScopeKeysWithColumn<Scope, C> extends infer U
					? [U] extends [never]
						? SqlParserError<"Unknown column in DELETE WHERE">
						: null
					: never
			: null

type MaximalIdentChain<Tokens extends TokensList> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, TokenIdent<infer A extends string>]
		? PeekToken<R1> extends TokenKey<".">
			? ReadToken<R1> extends [infer R2 extends TokensList, TokenKey<".">]
				? ReadToken<R2> extends [infer R3 extends TokensList, TokenIdent<infer B extends string>]
					? PeekToken<R3> extends TokenKey<".">
						? ReadToken<R3> extends [infer R4 extends TokensList, TokenKey<".">]
							? ReadToken<R4> extends [infer R5 extends TokensList, TokenIdent<infer C extends string>]
								? [R5, readonly [A, B, C]]
								: never
							: never
						: [R3, readonly [A, B]]
					: never
				: never
			: [R1, readonly [A]]
		: never

type TryOperandIdentColumnRefBody<
	Rm extends TokensList,
	Parts extends readonly string[],
	Db extends JsqlDatabaseShape,
	Scope extends ScopeMap,
> = Parts extends readonly [string, string, string]
	? ValidateDeleteColumnParts<Db, Scope, Parts> extends infer E
		? E extends SqlParserError<string>
			? [Rm, E]
			: [Rm, null]
		: never
	: Parts extends readonly [string, string]
		? ValidateDeleteColumnParts<Db, Scope, Parts> extends infer E
			? E extends SqlParserError<string>
				? [Rm, E]
				: [Rm, null]
			: never
		: Parts extends readonly [string]
			? ValidateDeleteColumnParts<Db, Scope, Parts> extends infer E
				? E extends SqlParserError<string>
					? [Rm, E]
					: [Rm, null]
				: never
			: never

type TryOperandIdentOrCall<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	MaximalIdentChain<Tokens> extends [infer Rm extends TokensList, infer Parts extends readonly string[]]
		? PeekToken<Rm> extends TokenKey<"(">
			? SkipBracketedUntil<SkipToken<Rm>, TokenKey<")">> extends [infer After extends TokensList, infer Rs]
				? Rs extends SqlParserError<string>
					? [After, SqlParserError<"Unbalanced parentheses in DELETE WHERE">]
					: [After, null]
				: never
			: TryOperandIdentColumnRefBody<Rm, Parts, Db, Scope>
		: never

type TryOperand<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"(">
		? SkipBracketedUntil<SkipToken<Tokens>, TokenKey<")">> extends [infer AfterSp extends TokensList, infer Rs]
			? Rs extends SqlParserError<string>
				? [AfterSp, SqlParserError<"Unbalanced parentheses in DELETE WHERE">]
				: [AfterSp, null]
			: never
		: PeekToken<Tokens> extends TokenKey<"true"> | TokenKey<"false"> | TokenKey<"null">
			? ReadToken<Tokens> extends [infer R extends TokensList, unknown]
				? [R, null]
				: never
			: PeekToken<Tokens> extends TokenString<string>
				? ReadToken<Tokens> extends [infer R extends TokensList, unknown]
					? [R, null]
					: never
				: PeekToken<Tokens> extends TokenNumber<string>
					? ReadToken<Tokens> extends [infer R extends TokensList, unknown]
						? [R, null]
						: never
					: PeekToken<Tokens> extends TokenParam<string>
						? ReadToken<Tokens> extends [infer R extends TokensList, unknown]
							? [R, null]
							: never
						: PeekToken<Tokens> extends TokenIdent<string>
							? TryOperandIdentOrCall<Tokens, Db, Scope>
							: ReadToken<Tokens> extends [infer Rbad extends TokensList, infer _TokU]
								? [Rbad, SqlParserError<"Unexpected token in DELETE WHERE">]
								: never

type IsRelOp<T> =
	T extends TokenKey<"=">
		? true
		: T extends TokenKey<"<>">
			? true
			: T extends TokenKey<"!=">
				? true
				: T extends TokenKey<"<=">
					? true
					: T extends TokenKey<">=">
						? true
						: T extends TokenKey<"<">
							? true
							: T extends TokenKey<">">
								? true
								: false

type ParseWhereAfterOperand<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap, E0> =
	E0 extends SqlParserError<string> ? [Tokens, E0] : ParseWhereAfterOperandOk<Tokens, Db, Scope>

type ParseWhereAfterOperandOk<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends infer P
		? IsRelOp<P> extends true
			? ParseWhereAfterRelOp<Tokens, Db, Scope>
			: ParseWhereAfterOperandNoRel<Tokens, Db, Scope, P>
		: never

type ParseWhereAfterRelOp<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ReadToken<Tokens> extends [infer R2 extends TokensList, unknown]
		? TryOperand<R2, Db, Scope> extends [infer R3 extends TokensList, infer E2]
			? [R3, MergeErr<null, E2>]
			: never
		: never

type ParseWhereAfterOperandNoRel<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap, P> =
	P extends TokenKey<"is">
		? ReadToken<Tokens> extends [infer R4 extends TokensList, TokenKey<"is">]
			? ParseWhereAfterIs<R4>
			: never
		: P extends TokenKey<"in">
			? ReadToken<Tokens> extends [infer R8 extends TokensList, TokenKey<"in">]
				? PeekToken<R8> extends TokenKey<"(">
					? SkipBracketedUntil<SkipToken<R8>, TokenKey<")">> extends [infer R9 extends TokensList, infer Rs]
						? Rs extends SqlParserError<string>
							? [R9, SqlParserError<"Unbalanced parentheses in DELETE WHERE IN">]
							: [R9, null]
						: never
					: [R8, SqlParserError<"Expected `(` after IN in DELETE WHERE">]
				: never
			: [Tokens, null]

type ParseWhereAfterIs<R4 extends TokensList> =
	PeekToken<R4> extends TokenKey<"not">
		? ReadToken<R4> extends [infer R5 extends TokensList, TokenKey<"not">]
			? PeekToken<R5> extends TokenKey<"null">
				? ReadToken<R5> extends [infer R6 extends TokensList, TokenKey<"null">]
					? [R6, null]
					: ReadToken<R5> extends [infer R5b extends TokensList, infer _TokN]
						? [R5b, SqlParserError<"Expected NULL after IS NOT in DELETE WHERE">]
						: never
				: [R5, SqlParserError<"Expected NULL after IS NOT in DELETE WHERE">]
			: never
		: PeekToken<R4> extends TokenKey<"null">
			? ReadToken<R4> extends [infer R7 extends TokensList, TokenKey<"null">]
				? [R7, null]
				: never
			: [R4, SqlParserError<"Expected NULL after IS in DELETE WHERE">]

type ParseWherePrimary<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"(">
		? ReadToken<Tokens> extends [infer Ri extends TokensList, TokenKey<"(">]
			? ParseWhereOr<Ri, Db, Scope> extends [infer Rj extends TokensList, infer Ej]
				? Ej extends SqlParserError<string>
					? [Rj, Ej]
					: ReadToken<Rj> extends [infer Rk extends TokensList, infer TokCl]
						? TokCl extends TokenKey<")">
							? [Rk, null]
							: [Rk, SqlParserError<"Expected `)` in DELETE WHERE">]
						: never
				: never
			: never
		: TryOperand<Tokens, Db, Scope> extends [infer R1 extends TokensList, infer E1]
			? ParseWhereAfterOperand<R1, Db, Scope, E1>
			: never

type ParseWhereUnary<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	PeekToken<Tokens> extends TokenKey<"not">
		? ReadToken<Tokens> extends [infer Rn extends TokensList, TokenKey<"not">]
			? ParseWhereUnary<Rn, Db, Scope>
			: never
		: ParseWherePrimary<Tokens, Db, Scope>

type ParseWhereAnd<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ParseWhereUnary<Tokens, Db, Scope> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: ParseWhereAndLoop<R0, Db, Scope, null>
		: never

type ParseWhereAndLoop<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap, Acc> =
	PeekToken<Tokens> extends TokenKey<"and">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"and">]
			? ParseWhereUnary<R1, Db, Scope> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: ParseWhereAndLoop<R2, Db, Scope, MergeErr<Acc, E1>>
				: never
			: never
		: [Tokens, Acc]

type ParseWhereOr<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ParseWhereAnd<Tokens, Db, Scope> extends [infer R0 extends TokensList, infer E0]
		? E0 extends SqlParserError<string>
			? [R0, E0]
			: ParseWhereOrLoop<R0, Db, Scope, null>
		: never

type ParseWhereOrLoop<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap, Acc> =
	PeekToken<Tokens> extends TokenKey<"or">
		? ReadToken<Tokens> extends [infer R1 extends TokensList, TokenKey<"or">]
			? ParseWhereAnd<R1, Db, Scope> extends [infer R2 extends TokensList, infer E1]
				? E1 extends SqlParserError<string>
					? [R2, E1]
					: ParseWhereOrLoop<R2, Db, Scope, MergeErr<Acc, E1>>
				: never
			: never
		: [Tokens, Acc]

type ParseDeleteWhereClause<Tokens extends TokensList, Db extends JsqlDatabaseShape, Scope extends ScopeMap> =
	ParseWhereOr<Tokens, Db, Scope> extends [infer Rw extends TokensList, infer Ew]
		? Ew extends SqlParserError<string>
			? [Rw, Ew]
			: [Rw, null]
		: never
