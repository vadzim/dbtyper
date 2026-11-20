import type {
	JsqlDatabaseShape,
	JsqlDataShape,
	JsqlSchemaShape,
	JsqlSelectStatementResult,
} from "../core/jsql-shapes.ts"
import type { JsqlCreateView, JsqlDbGetSchema, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken } from "../lexer/parser-monad.ts"
import type { TokenEot } from "../lexer/sql-lexer.ts"
import type { TokenIdent } from "../lexer/sql-lexer.ts"
import type { TokenKey } from "../lexer/sql-lexer.ts"
import type { ParserMonad } from "../lexer/parser-monad.ts"
import type { DbtyperErrorShape, FormatError, Errors } from "../dbtyper-error.ts"
import type { ParseNameParts } from "./parse-qualified-name.ts"
import type { SkipBracketedUntil, SkipFailedStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ApplyCteColumnList, ParseCteColumnList } from "./parse-select-cte.ts"
import type { ParseSelectExpression } from "./parse-select.ts"
import type { DialectFact } from "../core/dialect.ts"
import type { FirstDuplicateName } from "./set-operation-types.ts"
import type { FoldedNames, OutputOrder, OutputRelation } from "./parser-scope.ts"
import type { SqlTypeShape } from "../core/sql-type-shape.ts"

type ViewNameRow = {
	name: FormatError<Errors["EXPECTED_VIEW_NAME_IN_CREATE_VIEW"], []>
	afterDot: FormatError<Errors["EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW"], []>
	ends: TokenKey<"as" | "(">
	plain: FormatError<Errors["EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME"], []>
	qualified: FormatError<Errors["EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME"], []>
	skip: true
	home: "default"
}

/**
 * `view_name AS` or `schema.view_name AS` (unlike {@link ParseQualifiedTableName}, not followed by `(`).
 * Success: `[rest before AS, null, schema, viewName]`.
 */
type ParseQualifiedViewName<Tokens extends ParserMonad, Db extends JsqlDatabaseShape> = ParseNameParts<
	Tokens,
	Db,
	ViewNameRow
>

type ParseCreateViewAfterSelect<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
	Cols,
> = (
	Cols extends readonly string[]
		? FirstDuplicateName<DialectFact<Db, "lexer">["foldQuoted"] extends true ? FoldedNames<Cols> : Cols>
		: never
) extends infer Dup
	? [Dup] extends [never]
		? ApplyCteColumnList<Sel, Cols> extends infer Named extends JsqlSelectStatementResult
			? ParseCreateViewStore<Tokens, Db, Schema, Name, Named>
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["VIEW_COLUMN_LIST_MISMATCH"], [Name]>>
		: // PostgreSQL and SQLite both reject a name given twice in the view's column list
			SkipFailedStatement<Tokens, Db, FormatError<Errors["DUPLICATE_VIEW_COLUMN"], [Name, Dup & string]>>
	: never

type ParseCreateViewStore<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> =
	PeekToken<Tokens> extends TokenIdent<"with">
		? // PGT-20: `CREATE MATERIALIZED VIEW … WITH [NO] DATA`
			SkipToken<Tokens> extends infer R1 extends ParserMonad
			? PeekToken<R1> extends TokenIdent<"no"> | TokenKey<"no">
				? SkipToken<R1> extends infer R2 extends ParserMonad
					? ParseCreateViewStore<SkipToken<R2>, Db, Schema, Name, Sel>
					: never
				: ParseCreateViewStore<SkipToken<R1>, Db, Schema, Name, Sel>
			: never
		: PeekToken<Tokens> extends TokenKey<";"> | TokenEot
			? JsqlDbReplaceData<
					Db,
					Schema,
					Name,
					OutputRelation<Db, Sel["returning"], OutputOrder<Sel>> extends infer Rel extends {
						columns: Record<string, SqlTypeShape>
					}
						? JsqlCreateView<
								Rel["columns"],
								Rel extends { order: infer O extends readonly string[] } ? O : readonly string[],
								Rel extends { spelled: infer Sp } ? Sp : {}
							>
						: never
				> extends infer NewDb
				? NewDb extends JsqlDatabaseShape
					? [SkipToken<Tokens>, NewDb, null]
					: never
				: never
			: SkipFailedStatement<Tokens, Db, FormatError<Errors["EXPECTED_SEMICOLON"], ["CREATE VIEW"]>>

type ParseCreateViewSelectAndSemi<
	R2 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
	Cols,
	IfNotExists extends boolean | "replace",
> = (
	JsqlDbGetData<Db, Sch, Vname> extends null
		? true
		: IfNotExists extends "replace"
			? JsqlDbGetData<Db, Sch, Vname> extends JsqlDataShape<"view">
				? true
				: false
			: false
) extends true
	? ParseSelectExpression<R2, Db, Params> extends [infer R3 extends ParserMonad, infer _Db2, infer Res]
		? Res extends DbtyperErrorShape
			? [R3, Db, Res]
			: Res extends JsqlSelectStatementResult
				? ParseCreateViewAfterSelect<R3, Db, Sch, Vname, Res, Cols>
				: never
		: never
	: IfNotExists extends true
		? SkipBracketedUntil<R2> extends [infer Rest extends ParserMonad, unknown]
			? [SkipToken<Rest>, Db, null]
			: never
		: SkipFailedStatement<R2, Db, FormatError<Errors["VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA"], []>>

type ParseCreateViewAfterAs<
	R1 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
	Cols,
	IfNotExists extends boolean | "replace",
> =
	PeekToken<R1> extends TokenIdent<"with">
		? ParseCreateViewSelectAndSemi<R1, Db, Sch, Vname, Params, Cols, IfNotExists>
		: PeekToken<R1> extends TokenKey<"select">
			? ParseCreateViewSelectAndSemi<SkipToken<R1>, Db, Sch, Vname, Params, Cols, IfNotExists>
			: SkipFailedStatement<R1, Db, FormatError<Errors["EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW"], []>>

/**
 * `CREATE [TEMP] VIEW [IF NOT EXISTS] name [(cols)] AS …`. `Temp` (SQLite, SQLT-22, SQLT-25) puts an unqualified view
 * into `temp`; the column list exists in both dialects, IF NOT EXISTS in SQLite only (`viewIfNotExists`).
 */
export type ParseCreateView<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
	Temp extends boolean = false,
	Replace extends boolean = false,
> =
	PeekToken<Tokens> extends TokenKey<"if">
		? DialectFact<Db, "viewIfNotExists"> extends true
			? SkipToken<Tokens> extends infer A0 extends ParserMonad
				? PeekToken<A0> extends TokenKey<"not">
					? SkipToken<A0> extends infer A1 extends ParserMonad
						? PeekToken<A1> extends TokenKey<"exists">
							? ParseCreateViewNamed<SkipToken<A1>, Db, Params, Temp, true>
							: SkipFailedStatement<
									A1,
									Db,
									FormatError<Errors["EXPECTED_EXISTS_AFTER_IF_NOT_IN_CREATE_VIEW"], []>
								>
						: never
					: SkipFailedStatement<A0, Db, FormatError<Errors["EXPECTED_NOT_AFTER_IF_IN_CREATE_VIEW"], []>>
				: never
			: ParseCreateViewNamed<Tokens, Db, Params, Temp, Replace extends true ? "replace" : false>
		: ParseCreateViewNamed<Tokens, Db, Params, Temp, Replace extends true ? "replace" : false>

type ParseCreateViewNamed<
	Tokens extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Temp extends boolean,
	IfNotExists extends boolean | "replace",
> =
	ParseQualifiedViewName<Tokens, Db> extends [
		infer R0 extends ParserMonad,
		infer E,
		infer Sch0 extends string,
		infer Vname extends string,
	]
		? E extends null
			? ParseCreateViewColumns<R0, Db, Params, Temp extends true ? "temp" : Sch0, Vname, IfNotExists>
			: [R0, Db, E]
		: never

type ParseCreateViewColumns<
	R0 extends ParserMonad,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape,
	Sch extends string,
	Vname extends string,
	IfNotExists extends boolean | "replace",
> =
	JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
		? ParseCteColumnList<R0> extends [infer R0b extends ParserMonad, infer Cols]
			? Cols extends DbtyperErrorShape
				? [R0b, Db, Cols]
				: PeekToken<R0b> extends TokenKey<"as">
					? SkipToken<R0b> extends infer R1 extends ParserMonad
						? Sch extends keyof Db["schemas"]
							? ParseCreateViewAfterAs<
									R1,
									Db,
									Sch & keyof Db["schemas"] & string,
									Vname,
									Params,
									Cols,
									IfNotExists
								>
							: never
						: never
					: SkipFailedStatement<R0b, Db, FormatError<Errors["EXPECTED_AS_IN_CREATE_VIEW"], []>>
			: never
		: SkipFailedStatement<R0, Db, FormatError<Errors["UNKNOWN_SCHEMA"], [Sch, "CREATE VIEW"]>>
