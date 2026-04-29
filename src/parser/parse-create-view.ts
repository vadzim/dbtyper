import type { JsqlDatabaseShape, JsqlSelectStatementResult } from "../../core/jsql-shapes.ts"
import type { MergeDbPreserveScalars } from "../../core/sql-scalar-types.ts"
import type {
	PeekToken,
	ReadToken,
	SkipToken,
	SqlParserError,
	TokenEot,
	TokenIdent,
	TokenKey,
	TokensList,
} from "../../core/sql-tokens.ts"
import type { EmptyExpressionParams, ExpressionParamsShape } from "./parse-expression.ts"
import type { ParseSelect } from "./parse-select.ts"

type HasConcreteSet<Sets extends object, Tab extends string> = string extends keyof Sets
	? false
	: Tab extends keyof Sets
		? true
		: false

type HasConcreteSchemaKey<Db extends JsqlDatabaseShape, Sch extends string> = string extends keyof Db["schemas"]
	? false
	: Sch extends keyof Db["schemas"]
		? true
		: false

/**
 * `view_name AS` or `schema.view_name AS` (unlike {@link ParseQualifiedTableName}, not followed by `(`).
 * Success: `[rest before AS, null, schema, viewName]`.
 */
type ParseQualifiedViewNameUnqualified<AfterFirst extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	PeekToken<AfterFirst> extends TokenKey<"as">
		? [AfterFirst, null, Db["defaultSchema"], A]
		: [AfterFirst, SqlParserError<"Expected AS or `.` before view name">, never, never]

type ParseQualifiedViewNameQualified<Rdot extends TokensList, Db extends JsqlDatabaseShape, A extends string> =
	ReadToken<Rdot> extends [infer AfterB extends TokensList, infer TokB]
		? TokB extends TokenIdent<infer B extends string>
			? HasConcreteSchemaKey<Db, A> extends true
				? PeekToken<AfterB> extends TokenKey<"as">
					? [AfterB, null, A & keyof Db["schemas"] & string, B]
					: [AfterB, SqlParserError<"Expected AS after qualified view name">, never, never]
				: [AfterB, SqlParserError<"Unknown schema for CREATE VIEW">, never, never]
			: [AfterB, SqlParserError<"Expected view name after `.` in CREATE VIEW">, never, never]
		: never

type ParseQualifiedViewNameAfterFirstIdent<
	AfterFirst extends TokensList,
	Db extends JsqlDatabaseShape,
	A extends string,
> =
	PeekToken<AfterFirst> extends TokenKey<".">
		? ReadToken<AfterFirst> extends [infer Rdot extends TokensList, TokenKey<".">]
			? ParseQualifiedViewNameQualified<Rdot, Db, A>
			: never
		: ParseQualifiedViewNameUnqualified<AfterFirst, Db, A>

type ParseQualifiedViewName<Tokens extends TokensList, Db extends JsqlDatabaseShape> =
	ReadToken<Tokens> extends [infer AfterFirst extends TokensList, infer NameTok]
		? NameTok extends TokenIdent<infer A extends string>
			? ParseQualifiedViewNameAfterFirstIdent<AfterFirst, Db, A>
			: [AfterFirst, SqlParserError<"Expected view name in CREATE VIEW">, never, never]
		: never

type MergeViewIntoDb<
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> = Schema extends keyof Db["schemas"]
	? MergeDbPreserveScalars<
			Db,
			{
				defaultSchema: Db["defaultSchema"]
				schemas: {
					[K in keyof Db["schemas"]]: K extends Schema
						? {
								sets: Db["schemas"][K]["sets"] &
									Record<
										Name,
										{
											kind: "view"
											columns: Sel["columns"]
											column_sql_types: Sel["column_sql_types"]
										}
									>
							}
						: Db["schemas"][K]
				}
			}
		>
	: never

type ParseCreateViewAfterSelect<
	Tokens extends TokensList,
	Db extends JsqlDatabaseShape,
	Schema extends string,
	Name extends string,
	Sel extends JsqlSelectStatementResult,
> =
	ReadToken<Tokens> extends [infer R1 extends TokensList, infer TokEnd]
		? TokEnd extends TokenKey<";"> | TokenEot
			? MergeViewIntoDb<Db, Schema, Name, Sel> extends infer NewDb
				? NewDb extends JsqlDatabaseShape
					? [R1, NewDb, null]
					: never
				: never
			: [R1, Db, SqlParserError<"Expected semicolon after CREATE VIEW">]
		: never

type ParseCreateViewSelectAndSemi<
	R2 extends TokensList,
	Db extends JsqlDatabaseShape,
	Sch extends keyof Db["schemas"] & string,
	Vname extends string,
	Params extends ExpressionParamsShape,
> =
	HasConcreteSet<Db["schemas"][Sch]["sets"], Vname> extends true
		? [R2, Db, SqlParserError<"View or table already exists in schema">]
		: ParseSelect<R2, Db, Params> extends [infer R3 extends TokensList, infer _Db2, infer Res]
			? Res extends SqlParserError<string>
				? [R3, Db, Res]
				: Res extends JsqlSelectStatementResult
					? ParseCreateViewAfterSelect<R3, Db, Sch, Vname, Res>
					: never
			: never

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
			: [R1, Db, SqlParserError<"Expected SELECT or WITH after AS in CREATE VIEW">]

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
			? HasConcreteSchemaKey<Db, Sch> extends true
				? PeekToken<R0> extends TokenKey<"as">
					? ReadToken<R0> extends [infer R1 extends TokensList, TokenKey<"as">]
						? ParseCreateViewAfterAs<R1, Db, Sch & keyof Db["schemas"] & string, Vname, Params>
						: never
					: [R0, Db, SqlParserError<"Expected AS in CREATE VIEW">]
				: [R0, Db, SqlParserError<"Unknown schema for CREATE VIEW">]
			: [R0, Db, E]
		: never
