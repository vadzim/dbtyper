import type { JsqlDatabaseShape, JsqlDataShape } from "../core/jsql-shapes.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { AsIdent, TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseTableRef, TableRefTarget } from "./parse-table-ref.ts"
import type { ParserRefErrorThirdSentinel } from "./parser-ref-error-third-sentinel.ts"
import type { MergeScope, ScopeMap, TableScopeColumns } from "./parser-scope.ts"

export type UpdateTableContext = {
	scope: ScopeMap
	tbl: JsqlDataShape
	schema: string
	table: string
}

type ParseUpdateAliasAfterTable<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends string,
	Tab extends string,
	Tbl extends JsqlDataShape,
	AfterAs extends boolean = false,
> =
	PeekToken<Tokens> extends TokenKey<"as">
		? AfterAs extends false
			? ParseUpdateAliasAfterTable<SkipToken<Tokens>, Db, Sch, Tab, Tbl, true>
			: [
					SkipToken<Tokens>,
					FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
					ParserRefErrorThirdSentinel,
				]
		: [AfterAs, PeekToken<Tokens>] extends [false, TokenKey<"set">]
			? [
					Tokens,
					null,
					{
						scope: MergeScope<
							Record<
								Tab,
								{
									schema: Sch
									table: Tab
									columns: TableScopeColumns<Tbl>
								}
							>,
							{}
						>
						tbl: Tbl
						schema: Sch
						table: Tab
					},
				]
			: PeekToken<Tokens> extends infer TokAlias
				? SkipToken<Tokens> extends infer Ra extends ParserMonad
					? [AfterAs, DialectFact<Db, "bareDmlAlias">, AsIdent<TokAlias>] extends [
							false,
							false,
							TokenIdent<infer BareAlias extends string>,
						]
						? [
								Ra,
								FormatError<Errors["BARE_DML_ALIAS_NEEDS_AS"], ["UPDATE", BareAlias]>,
								ParserRefErrorThirdSentinel,
							]
						: AsIdent<TokAlias> extends TokenIdent<infer Alias extends string>
							? PeekToken<Ra> extends TokenKey<"set">
								? [
										Ra,
										null,
										{
											scope: MergeScope<
												Record<
													Alias,
													{
														schema: Sch
														table: Tab
														columns: TableScopeColumns<Tbl>
													}
												>,
												{}
											>
											tbl: Tbl
											schema: Sch
											table: Tab
										},
									]
								: [
										Ra,
										FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
										ParserRefErrorThirdSentinel,
									]
							: [
									Ra,
									FormatError<Errors["EXPECTED_SET_AFTER_TABLE_IN_UPDATE"], []>,
									ParserRefErrorThirdSentinel,
								]
					: never
				: never

export type ParseUpdateFromTableRef<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> =
	ParseTableRef<Tokens, Db, "UPDATE", "UPDATE"> extends [infer R extends ParserMonad, infer E, infer Target]
		? E extends null
			? Target extends TableRefTarget<
					infer Sch extends string,
					infer Tab extends string,
					infer Tbl extends JsqlDataShape
				>
				? ParseUpdateAliasAfterTable<R, Db, Sch, Tab, Tbl>
				: never
			: [R, E, Target]
		: never

/** `[column, expression]` pairs of SET, resolved once the FROM scope is known (SQLT-42): see {@link ResolveUpdateAssignments}. */
