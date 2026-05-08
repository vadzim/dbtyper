import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { JsqlCreateView, JsqlDbGetSchema, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { DbtyperError, FormatError } from "../sql-parser-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseSelectExpression } from "./parse-select.ts"

/**
 * `view_name AS` or `schema.view_name AS` (unlike {@link ParseQualifiedTableName}, not followed by `(`).
 * Success: `[rest before AS, null, schema, viewName]`.
 */
type ParseQualifiedViewNameUnqualified<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"as">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: SkipFailedQualifiedName<AfterFirst, FormatError<"EXPECTED_AS_OR_DOT_BEFORE_VIEW_NAME", []>>

type ParseQualifiedViewNameQualified<Rdot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<Rdot> extends TokenIdent<infer B extends string>
		? SkipToken<Rdot> extends infer AfterB extends TokensList
			? JsqlDbGetSchema<Db, A> extends JsqlSchemaShape
				? PeekToken<AfterB> extends TokenKey<"as">
					? A extends keyof Db["schemas"]
						? [AfterB, null, A & keyof Db["schemas"] & string, B]
						: never
					: SkipFailedQualifiedName<AfterB, FormatError<"EXPECTED_AS_AFTER_QUALIFIED_VIEW_NAME", []>>
				: SkipFailedQualifiedName<AfterB, FormatError<"UNKNOWN_SCHEMA_FOR_CREATE_VIEW", [A]>>
			: never
		: SkipFailedQualifiedName<Rdot, FormatError<"EXPECTED_VIEW_NAME_AFTER_DOT_IN_CREATE_VIEW", []>>

type ParseQualifiedViewNameAfterFirstIdent<
	AfterFirst extends TokensList,
	Db extends JsqlDatabaseShape,
	A extends string,
> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? SkipToken<AfterFirst> extends infer Rdot extends TokensList
			? ParseQualifiedViewNameQualified<Rdot, Db, A>
			: never
		: ParseQualifiedViewNameUnqualified<AfterFirst, Db, A>

type ParseQualifiedViewName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	PeekToken<Tokens> extends TokenIdent<infer A extends string>
		? ParseQualifiedViewNameAfterFirstIdent<SkipToken<Tokens>, Db, A>
		: SkipFailedQualifiedName<Tokens, FormatError<"EXPECTED_VIEW_NAME_IN_CREATE_VIEW", []>>

type ParseCreateViewAfterSelect<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> =
	PeekToken<Tokens> extends TokenKey<";"> | TokenEot
		? JsqlDbReplaceData<Db, Schema, Name, JsqlCreateView<Sel["columns"]>> extends infer NewDb
			? NewDb extends JsqlDatabaseShape
				? [SkipToken<Tokens>, NewDb, null]
				: never
			: never
		: SkipFailedStatement<Tokens, Db, FormatError<"EXPECTED_SEMICOLON_AFTER_CREATE_VIEW", []>>

type ParseCreateViewSelectAndSemi<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
> =
	JsqlDbGetData<Db, Sch, Vname> extends null
		? ParseSelectExpression<R2, Db, Params> extends [infer R3 extends TokensList, infer _Db2, infer Res]
			? Res extends DbtyperError<-1 | keyof typeof import("../sql-parser-error.ts").errors, string>
				? [R3, Db, Res]
				: Res extends JsqlSelectStatementResult
					? ParseCreateViewAfterSelect<R3, Db, Sch, Vname, Res>
					: never
			: never
		: SkipFailedStatement<R2, Db, FormatError<"VIEW_OR_TABLE_ALREADY_EXISTS_IN_SCHEMA", []>>

type ParseCreateViewAfterAs<
	R1 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
> =
	PeekToken<R1> extends TokenIdent<"with">
		? ParseCreateViewSelectAndSemi<R1, Db, Sch, Vname, Params>
		: PeekToken<R1> extends TokenKey<"select">
			? ParseCreateViewSelectAndSemi<SkipToken<R1>, Db, Sch, Vname, Params>
			: SkipFailedStatement<R1, Db, FormatError<"EXPECTED_SELECT_OR_WITH_AFTER_AS_IN_CREATE_VIEW", []>>

export type ParseCreateView<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Params extends ExpressionParamsShape = EmptyExpressionParams,
> =
	ParseQualifiedViewName<Tokens, Db> extends [
		infer R0 extends TokensList,
		infer E,
		infer Sch extends string,
		infer Vname extends string,
	]
		? E extends null
			? JsqlDbGetSchema<Db, Sch> extends JsqlSchemaShape
				? PeekToken<R0> extends TokenKey<"as">
					? SkipToken<R0> extends infer R1 extends TokensList
						? Sch extends keyof Db["schemas"]
							? ParseCreateViewAfterAs<R1, Db, Sch & keyof Db["schemas"] & string, Vname, Params>
							: never
						: never
					: SkipFailedStatement<R0, Db, FormatError<"EXPECTED_AS_IN_CREATE_VIEW", []>>
				: SkipFailedStatement<R0, Db, FormatError<"UNKNOWN_SCHEMA_FOR_CREATE_VIEW", [Sch]>>
			: [R0, Db, E]
		: never
