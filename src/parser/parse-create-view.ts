import type { JsqlDatabaseShape, JsqlSchemaShape, JsqlSelectStatementResult } from "../core/jsql-shapes.ts"
import type { JsqlCreateView, JsqlDbGetSchema, JsqlDbGetData, JsqlDbReplaceData } from "../core/jsql-utils.ts"
import type { PeekToken, SkipToken, TokenEot, TokenIdent, TokenKey, TokensList } from "../lexer/sql-tokens.ts"
import type { SqlParserError } from "../sql-parser-error.ts"
import type { SkipFailedQualifiedName } from "./skip-statement.ts"
import type { SkipFailedExpression, SkipFailedStatement } from "./skip-statement.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseSelect } from "./parse-select.ts"

/**
 * `view_name AS` or `schema.view_name AS` (unlike {@link ParseQualifiedTableName}, not followed by `(`).
 * Success: `[rest before AS, null, schema, viewName]`.
 */
type ParseQualifiedViewNameUnqualified<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"as">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: SkipFailedQualifiedName<AfterFirst, SqlParserError<"Expected AS or `.` before view name">>

type ParseQualifiedViewNameQualified<Rdot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<Rdot> extends TokenIdent<infer B extends string>
		? SkipToken<Rdot> extends infer AfterB extends TokensList
			? JsqlDbGetSchema<Db, A> extends JsqlSchemaShape
				? PeekToken<AfterB> extends TokenKey<"as">
					? A extends keyof Db["schemas"]
						? [AfterB, null, A & keyof Db["schemas"] & string, B]
						: never
					: SkipFailedQualifiedName<AfterB, SqlParserError<"Expected AS after qualified view name">>
				: SkipFailedQualifiedName<AfterB, SqlParserError<"Unknown schema for CREATE VIEW">>
			: never
		: SkipFailedQualifiedName<Rdot, SqlParserError<"Expected view name after `.` in CREATE VIEW">>

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
		: SkipFailedQualifiedName<Tokens, SqlParserError<"Expected view name in CREATE VIEW">>

type ParseCreateViewAfterSelect<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> =
	PeekToken<Tokens> extends infer TokEnd
		? SkipToken<Tokens> extends infer R1 extends TokensList
			? TokEnd extends TokenKey<";"> | TokenEot
				? JsqlDbReplaceData<Db, Schema, Name, JsqlCreateView<Sel["columns"]>> extends infer NewDb
					? NewDb extends JsqlDatabaseShape
						? [R1, NewDb, null]
						: never
					: never
				: SkipFailedStatement<R1, Db, SqlParserError<"Expected semicolon after CREATE VIEW">>
			: never
		: never

type ParseCreateViewSelectAndSemi<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
> =
	JsqlDbGetData<Db, Sch, Vname> extends null
		? ParseSelect<R2, Db, Params> extends [infer R3 extends TokensList, infer _Db2, infer Res]
			? Res extends SqlParserError<string>
				? [R3, Db, Res]
				: Res extends JsqlSelectStatementResult
					? ParseCreateViewAfterSelect<R3, Db, Sch, Vname, Res>
					: never
			: never
		: SkipFailedStatement<R2, Db, SqlParserError<"View or table already exists in schema">>

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
			: SkipFailedStatement<R1, Db, SqlParserError<"Expected SELECT or WITH after AS in CREATE VIEW">>

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
					: SkipFailedStatement<R0, Db, SqlParserError<"Expected AS in CREATE VIEW">>
				: SkipFailedStatement<R0, Db, SqlParserError<"Unknown schema for CREATE VIEW">>
			: [R0, Db, E]
		: never
